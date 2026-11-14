resource "aws_db_subnet_group" "main" {
  name       = var.project
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_parameter_group" "mysql" {
  name   = "${var.project}-mysql84"
  family = "mysql8.4"

  parameter {
    name  = "character_set_server"
    value = "utf8mb4"
  }
  parameter {
    name  = "collation_server"
    value = "utf8mb4_0900_ai_ci"
  }
  parameter {
    name  = "time_zone"
    value = "UTC"
  }
}

resource "aws_db_instance" "main" {
  identifier     = var.project
  engine         = "mysql"
  engine_version = "8.4"
  instance_class = var.db_instance_class

  allocated_storage     = 20
  max_allocated_storage = 50
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "cowork_hub_production"
  username = "coworkhub"
  # パスワードはRDSがSecrets Managerで自動生成・管理する
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  parameter_group_name   = aws_db_parameter_group.mysql.name
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period = 1
  # 学習用：destroy時に最終スナップショットを作らない
  skip_final_snapshot = true
  deletion_protection = false
  apply_immediately   = true
}
