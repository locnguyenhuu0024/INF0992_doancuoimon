#!/bin/bash

# Chạy docker-compose với cả file chính và file nodejs-sensor-service
docker-compose -f mainflux/docker/docker-compose.yml -f mainflux/docker/nodejs-sensor-service.yml up -d