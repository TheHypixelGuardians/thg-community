## build runner
FROM node:24-alpine AS build-runner

# Prisma's engines need openssl on Alpine
RUN apk add --no-cache openssl

# Set temp directory
WORKDIR /tmp/app

# Install dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-scripts

# Move source files
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY src ./src

# Generate the Prisma client and build project (yarn build runs prisma generate)
RUN yarn build

## production runner
FROM node:24-alpine AS prod-runner

# Prisma's engines need openssl on Alpine
RUN apk add --no-cache openssl

# Set work directory
WORKDIR /app

# Install production dependencies
COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile --ignore-scripts

# Move build files (the generated Prisma client is compiled into build/)
COPY --from=build-runner /tmp/app/build /app/build

# Start bot
CMD [ "node", "build/main.js" ]
