FROM node:12

EXPOSE 5000

WORKDIR /app

ADD ./package-lock.json /app/package-lock.json

ADD ./package.json /app/package.json

RUN npm ci

ADD . /app

CMD npm start