"""ECS のサービスの出来事を Slack に知らせる（service_notifications.tf）

- デプロイの完了・失敗：ECS Deployment State Change（SERVICE_DEPLOYMENT_COMPLETED / FAILED）
- 夜間停止の完了：すべてのサービスが「目標0台・稼働0台」になったとき
- 起動の完了：すべてのサービスが「目標の台数どおりに稼働して安定した」とき（ECS の SERVICE_STEADY_STATE）

夜間停止・起動は、指示を出したときではなく、ECS の実際の状態を見て、状態が変わったときだけ1通送る
（前の状態は SSM パラメータに残す。同じ状態のイベントが何回来ても、通知は1回）。
通知は SNS（Amazon Q Developer in chat applications のカスタム通知の形）で送る。
"""

import json
import os

import boto3

ecs = boto3.client("ecs")
sns = boto3.client("sns")
ssm = boto3.client("ssm")

CLUSTER = os.environ["CLUSTER"]
SERVICES = os.environ["SERVICES"].split(",")
TOPIC_ARN = os.environ["TOPIC_ARN"]
STATE_PARAM = os.environ["STATE_PARAM"]
NIGHT_STOP_END = os.environ.get("NIGHT_STOP_END", "")


def notify(title, description):
    message = {
        "version": "1.0",
        "source": "custom",
        "content": {"textType": "client-markdown", "title": title, "description": description},
    }
    sns.publish(TopicArn=TOPIC_ARN, Message=json.dumps(message, ensure_ascii=False))
    print(json.dumps({"notified": title}, ensure_ascii=False))


def describe_services():
    return ecs.describe_services(cluster=CLUSTER, services=SERVICES)["services"]


def image_tag(task_definition_arn):
    """タスク定義のイメージのタグ（デプロイしたコミット）"""
    td = ecs.describe_task_definition(taskDefinition=task_definition_arn)["taskDefinition"]
    image = td["containerDefinitions"][0]["image"]
    return image.rsplit(":", 1)[-1] if ":" in image else image


def overall_state(services):
    """すべてのサービスが止まっていれば stopped、目標どおり動いて安定していれば running、それ以外（途中）は None"""
    if all(s["desiredCount"] == 0 and s["runningCount"] == 0 and s["pendingCount"] == 0 for s in services):
        return "stopped"
    if all(
        s["desiredCount"] > 0
        and s["runningCount"] == s["desiredCount"]
        and s["pendingCount"] == 0
        and len(s["deployments"]) == 1
        for s in services
    ):
        return "running"
    return None


def on_deployment(event):
    detail = event["detail"]
    name = event["resources"][0].rsplit("/", 1)[-1]
    service = next((s for s in describe_services() if s["serviceName"] == name), None)
    # サービスが今使っているタスク定義のタグ。失敗したときは、戻した先（前の版）のタグになる
    tag = image_tag(service["taskDefinition"]) if service else "?"
    if detail["eventName"] == "SERVICE_DEPLOYMENT_COMPLETED":
        notify(f":rocket: デプロイ完了：{name}", f"`{tag}` で動いています")
    else:
        reason = detail.get("reason", "理由は ECS のサービスのイベントを確認してください")
        notify(f":x: デプロイ失敗：{name}", f"{reason}\n今は `{tag}` で動いています（失敗した版ではなく、戻した先の版）")


def on_state_change(event):
    services = describe_services()
    state = overall_state(services)
    # 起動の完了は「安定した」イベントのときだけ判定する（タスクが起動しただけでは、まだヘルスチェック前のため）
    if state is None or (state == "running" and event["detail-type"] != "ECS Service Action"):
        return
    previous = ssm.get_parameter(Name=STATE_PARAM)["Parameter"]["Value"]
    if state == previous:
        return
    # 送ってから状態を書く。送った後に書き込みが失敗すると、再試行で2通届くことがある（通知が届かないよりよい）。
    # 同時に動いて2通になるのは、Lambda を1つずつ動かす設定（service_notifications.tf）で防ぐ
    if state == "stopped":
        notify(
            ":crescent_moon: 夜間停止が完了しました",
            f"{'・'.join(SERVICES)} を止めました。" + (f"再開は {NIGHT_STOP_END}（日本時間）です" if NIGHT_STOP_END else ""),
        )
    else:
        counts = "・".join(f"{s['serviceName']} {s['runningCount']}台" for s in services)
        notify(":sunrise: 起動が完了しました", f"{counts}が動いています")
    ssm.put_parameter(Name=STATE_PARAM, Value=state, Overwrite=True)


def handler(event, _context):
    print(json.dumps({"detail-type": event.get("detail-type"), "detail": event.get("detail", {}).get("eventName")}))
    if event.get("detail-type") == "ECS Deployment State Change":
        on_deployment(event)
    else:
        on_state_change(event)
