FROM node:lts-alpine

WORKDIR /opt/app
COPY package.json yarn.lock ./
RUN npm i react react-dom next
