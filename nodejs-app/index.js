const mqtt = require('mqtt');
const dotenv = require('dotenv');
const db = require('./services/db');
const telegramService = require('./services/telegram');

// Load environment variables from .env file
dotenv.config();

// Initialize the database and create tables if needed
db.initializeDatabase()
  .then(() => {
    console.log('Database initialized successfully');
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

// MQTT configuration from environment variables
const mqttConfig = {
  brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io',
  port: parseInt(process.env.MQTT_PORT || '1883', 10),
  clientId: process.env.MQTT_CLIENT_ID || `mqtt_client_${Math.random().toString(16).slice(2, 8)}`,
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  topic: process.env.MQTT_TOPIC || 'esp8266/sensor_data',
  qos: parseInt(process.env.MQTT_QOS || '0', 10)
};

// Gas threshold for alerts
const gasThreshold = parseInt(process.env.GAS_THRESHOLD || '600', 10);

// Print the configuration (excluding sensitive information)
console.log('MQTT Configuration:');
console.log(`Broker URL: ${mqttConfig.brokerUrl}`);
console.log(`Client ID: ${mqttConfig.clientId}`);
console.log(`Topic: ${mqttConfig.topic}`);
console.log(`QoS: ${mqttConfig.qos}`);
console.log(`Gas Threshold: ${gasThreshold}`);

// Connect to MQTT broker
const client = mqtt.connect(mqttConfig.brokerUrl, {
  port: mqttConfig.port,
  clientId: mqttConfig.clientId,
  username: mqttConfig.username,
  password: mqttConfig.password,
  clean: true
});

// Handle connection events
client.on('connect', () => {
  console.log('Connected to MQTT broker');
  
  // Subscribe to the topic
  client.subscribe(mqttConfig.topic, { qos: mqttConfig.qos }, (err) => {
    if (err) {
      console.error('Error subscribing to topic:', err);
      return;
    }
    console.log(`Subscribed to topic: ${mqttConfig.topic}`);
  });
});

// Handle message events
client.on('message', async (topic, message) => {
  console.log(`Received message from topic: ${topic}`);
  
  try {
    // Parse the JSON message
    const data = JSON.parse(message.toString());
    console.log('Data received:', data);
    
    // Extract sensor values
    const type = data.type || 'ESP8266'; // Default device type if not provided
    const temperature = parseFloat(data.temperature || 0);
    const humidity = parseFloat(data.humidity || 0);
    const gasVolume = parseFloat(data.gas_volume || 0);
    
    // Save data to database
    const savedData = await db.saveSensorData(type, temperature, humidity, gasVolume);
    console.log('Data saved to database successfully');

    // Process sensor data for Telegram notifications
    await telegramService.processSensorData({
      type,
      temperature,
      humidity,
      gas_volume: gasVolume,
      created_at: savedData.created_at
    });
    
  } catch (error) {
    if (error.name === 'SyntaxError') {
      console.error('Error parsing JSON message:', error.message);
      console.log('Raw message:', message.toString());
    } else {
      console.error('Error processing message:', error);
    }
  }
});

// Handle error events
client.on('error', (err) => {
  console.error('MQTT Error:', err);
});

// Handle close event
client.on('close', () => {
  console.log('Connection to MQTT broker closed');
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Disconnecting from MQTT broker...');
  client.end();
  db.pool.end().then(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});
