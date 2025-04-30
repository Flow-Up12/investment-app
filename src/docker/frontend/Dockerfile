FROM node:16

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Build the React app
RUN npm run build

# Expose port for the frontend
EXPOSE 3000

CMD ["npm", "start"] 