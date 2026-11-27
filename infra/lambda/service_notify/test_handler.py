"""handler.py の判定のテスト（AWS を呼ばない）。 python3 -m unittest discover -s infra/lambda/service_notify"""

import json
import os
import sys
import types
import unittest
from unittest import mock

os.environ.update(CLUSTER="c", SERVICES="backend,frontend", TOPIC_ARN="arn:topic", STATE_PARAM="/p", NIGHT_STOP_END="03:00")
sys.modules["boto3"] = types.SimpleNamespace(client=lambda name: mock.MagicMock(name=name))
sys.path.insert(0, os.path.dirname(__file__))
import handler  # noqa: E402


def svc(name, desired, running, pending=0, deployments=1):
    return {"serviceName": name, "desiredCount": desired, "runningCount": running, "pendingCount": pending,
            "deployments": [{}] * deployments, "taskDefinition": f"td/{name}:1"}


class StateTest(unittest.TestCase):
    def setUp(self):
        handler.sns.reset_mock()
        handler.ssm.reset_mock()
        self.stored = {"value": "running"}
        handler.ssm.get_parameter.side_effect = lambda Name: {"Parameter": {"Value": self.stored["value"]}}
        handler.ssm.put_parameter.side_effect = lambda Name, Value, Overwrite: self.stored.update(value=Value)

    def run_event(self, services, detail_type):
        handler.ecs.describe_services.return_value = {"services": services}
        handler.handler({"detail-type": detail_type, "detail": {}}, None)

    def titles(self):
        return [json.loads(c.kwargs["Message"])["content"]["title"] for c in handler.sns.publish.call_args_list]

    def test_夜間停止はすべて止まったときに1回だけ(self):
        self.run_event([svc("backend", 0, 0), svc("frontend", 0, 1)], "ECS Task State Change")  # まだ途中
        self.run_event([svc("backend", 0, 0), svc("frontend", 0, 0)], "ECS Task State Change")
        self.run_event([svc("backend", 0, 0), svc("frontend", 0, 0)], "ECS Service Action")  # 同じ状態がもう一度
        self.assertEqual(self.titles(), [":crescent_moon: 夜間停止が完了しました"])

    def test_起動はすべて安定したときに1回だけ(self):
        self.stored["value"] = "stopped"
        self.run_event([svc("backend", 1, 1), svc("frontend", 1, 1)], "ECS Task State Change")  # 安定のイベントではない
        self.run_event([svc("backend", 1, 0, pending=1), svc("frontend", 1, 1)], "ECS Service Action")  # backend が起動中
        self.run_event([svc("backend", 1, 1), svc("frontend", 1, 1)], "ECS Service Action")
        self.run_event([svc("backend", 1, 1), svc("frontend", 1, 1)], "ECS Service Action")
        self.assertEqual(self.titles(), [":sunrise: 起動が完了しました"])

    def test_起動に失敗して繰り返しているあいだは送らない(self):
        self.stored["value"] = "stopped"
        self.run_event([svc("backend", 1, 0, pending=1), svc("frontend", 1, 1)], "ECS Service Action")
        self.assertEqual(self.titles(), [])

    def test_デプロイの途中は状態を変えない(self):
        self.run_event([svc("backend", 1, 2, deployments=2), svc("frontend", 1, 1)], "ECS Task State Change")
        self.assertEqual(self.titles(), [])
        self.assertEqual(self.stored["value"], "running")

    def test_デプロイの完了と失敗(self):
        handler.ecs.describe_services.return_value = {"services": [svc("backend", 1, 1)]}
        handler.ecs.describe_task_definition.return_value = {
            "taskDefinition": {"containerDefinitions": [{"image": "123.dkr.ecr/cowork-hub/backend:abc1234"}]}}
        arn = ["arn:aws:ecs:ap-northeast-1:1:service/c/backend"]
        handler.handler({"detail-type": "ECS Deployment State Change", "resources": arn,
                         "detail": {"eventName": "SERVICE_DEPLOYMENT_COMPLETED"}}, None)
        handler.handler({"detail-type": "ECS Deployment State Change", "resources": arn,
                         "detail": {"eventName": "SERVICE_DEPLOYMENT_FAILED", "reason": "ECS deployment circuit breaker"}}, None)
        self.assertEqual(self.titles(), [":rocket: デプロイ完了：backend", ":x: デプロイ失敗：backend"])
        descriptions = [json.loads(c.kwargs["Message"])["content"]["description"] for c in handler.sns.publish.call_args_list]
        self.assertIn("abc1234", descriptions[0])
        self.assertIn("戻した先の版", descriptions[1])

    def test_送れなかったら状態を書かない(self):
        handler.sns.publish.side_effect = RuntimeError("SNS に送れない")
        handler.ecs.describe_services.return_value = {"services": [svc("backend", 0, 0), svc("frontend", 0, 0)]}
        with self.assertRaises(RuntimeError):
            handler.handler({"detail-type": "ECS Task State Change", "detail": {}}, None)
        handler.sns.publish.side_effect = None
        self.assertEqual(self.stored["value"], "running")  # 再試行で、もう一度送れる


if __name__ == "__main__":
    unittest.main()
