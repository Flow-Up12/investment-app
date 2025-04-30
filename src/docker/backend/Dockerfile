FROM node:16

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Expose backend port
EXPOSE 5000

CMD ["npm", "start"] 