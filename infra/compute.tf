resource "aws_launch_template" "app" {
  name          = "notes-app-lt"
  image_id      = data.aws_ssm_parameter.al2023.value
  instance_type = var.app_instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.app.name
  }

  network_interfaces {
    associate_public_ip_address = false
    security_groups             = [aws_security_group.app.id]
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_type = "gp3"
      volume_size = 12
      encrypted   = true
    }
  }

  user_data = base64encode(templatefile("${path.module}/templates/app_user_data.sh.tftpl", {
    compose_b64 = filebase64("${path.module}/../deploy/docker-compose.prod.yml")
    deploy_b64  = filebase64("${path.module}/../deploy/deploy.sh")
  }))

  tag_specifications {
    resource_type = "instance"
    tags          = { Name = "notes-app", Role = "notes-app" }
  }
  tag_specifications {
    resource_type = "volume"
    tags          = { Name = "notes-app" }
  }
  tags = { Name = "notes-app-lt" }
}

resource "aws_autoscaling_group" "app" {
  name                      = "notes-app-asg"
  min_size                  = 2
  desired_capacity          = 2
  max_size                  = 4
  vpc_zone_identifier       = aws_subnet.app[*].id
  target_group_arns         = [aws_lb_target_group.web.arn]
  health_check_type         = "ELB"
  health_check_grace_period = 300
  enabled_metrics           = ["GroupMinSize", "GroupMaxSize", "GroupDesiredCapacity", "GroupInServiceInstances", "GroupTotalInstances"]

  launch_template {
    id      = aws_launch_template.app.id
    version = aws_launch_template.app.latest_version
  }

  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
    }
  }

  tag {
    key                 = "Name"
    value               = "notes-app"
    propagate_at_launch = false
  }

  depends_on = [aws_instance.db, aws_cloudwatch_log_group.app, aws_route_table_association.app]
}

resource "aws_autoscaling_policy" "cpu" {
  name                   = "notes-cpu-target-50"
  autoscaling_group_name = aws_autoscaling_group.app.name
  policy_type            = "TargetTrackingScaling"
  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 50
  }
}
