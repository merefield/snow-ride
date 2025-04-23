# Use official Deno base image
FROM denoland/deno:alpine

WORKDIR /app
ADD . /app

RUN deno cache server.ts

EXPOSE 8000
CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-env", "--allow-write", "--allow-run", "server.ts"]
