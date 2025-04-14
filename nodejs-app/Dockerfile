FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

# Run migrations on startup
CMD ["sh", "-c", "node migrations/init.js && npm start"]

# Expose the application port
EXPOSE 3000 