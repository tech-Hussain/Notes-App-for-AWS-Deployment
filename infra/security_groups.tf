resource "aws_security_group" "alb" {
  name        = "notes-alb-sg"
  description = "Public ALB"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "notes-alb-sg" }
}

resource "aws_security_group" "app" {
  name        = "notes-app-sg"
  description = "Web+API instances"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "notes-app-sg" }
}

resource "aws_security_group" "db" {
  name        = "notes-db-sg"
  description = "MongoDB"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "notes-db-sg" }
}

# ALB: HTTP from the internet, forwards to app SG only
resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = "0.0.0.0/0"
}
resource "aws_vpc_security_group_egress_rule" "alb_to_app" {
  security_group_id            = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = 80
  to_port                      = 80
  referenced_security_group_id = aws_security_group.app.id
}

# App: port 80 from ALB only; out to DB 27017 and HTTPS
resource "aws_vpc_security_group_ingress_rule" "app_from_alb" {
  security_group_id            = aws_security_group.app.id
  ip_protocol                  = "tcp"
  from_port                    = 80
  to_port                      = 80
  referenced_security_group_id = aws_security_group.alb.id
}
resource "aws_vpc_security_group_egress_rule" "app_to_db" {
  security_group_id            = aws_security_group.app.id
  ip_protocol                  = "tcp"
  from_port                    = 27017
  to_port                      = 27017
  referenced_security_group_id = aws_security_group.db.id
}
resource "aws_vpc_security_group_egress_rule" "app_https" {
  security_group_id = aws_security_group.app.id
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

# DB: 27017 from app SG only; out HTTPS
resource "aws_vpc_security_group_ingress_rule" "db_from_app" {
  security_group_id            = aws_security_group.db.id
  ip_protocol                  = "tcp"
  from_port                    = 27017
  to_port                      = 27017
  referenced_security_group_id = aws_security_group.app.id
}
resource "aws_vpc_security_group_egress_rule" "db_https" {
  security_group_id = aws_security_group.db.id
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}
