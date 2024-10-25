#!/bin/bash
# Script to setup node.js ready for card development.
# After completing setup, use
#
# npm run start
# or
# npm run build

sudo apt update
sudo apt install -y npm
sudo npm cache clean -f
sudo npm install -g n

sudo n stable
