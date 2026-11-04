resource "aws_instance" "db" {
  ami                    = data.aws_ssm_parameter.al2023.value
  instance_type          = var.db_instance_type
  subnet_id              = aws_subnet.db[0].id
  private_ip             = var.db_private_ip
  vpc_security_group_ids = [aws_security_group.db.id]
  iam_instance_profile   = aws_iam_instance_profile.db.name

  metadata_options {
    http_tokens = "required"
  }
  root_block_device {
    volume_type = "gp3"
    volume_size = 12
    encrypted   = true
  }
  user_data = templatefile("${path.module}/templates/db_user_data.sh.tftpl", {
    region    = var.region
    volume_id = aws_ebs_volume.mongo_data.id
  })
  user_data_replace_on_change = true
  tags                        = { Name = "notes-mongodb", Role = "notes-db" }
  depends_on                  = [aws_route_table_association.db, aws_nat_gateway.nat, aws_cloudwatch_log_group.app]
}

resource "aws_ebs_volume" "mongo_data" {
  availability_zone = var.azs[0]
  size              = 20
  type              = "gp3"
  encrypted         = true
  tags              = { Name = "notes-mongo-data" }
}

resource "aws_volume_attachment" "mongo_data" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.mongo_data.id
  instance_id = aws_instance.db.id
}
