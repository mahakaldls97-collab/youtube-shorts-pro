#!/usr/bin/env bash

# Create bin directory
mkdir -p bin

# Download yt-dlp Linux binary
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o bin/yt-dlp
chmod a+rx bin/yt-dlp

# Install app dependencies
npm install
