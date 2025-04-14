const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create PostgreSQL connection pool using environment variables
const pool = new Pool({
  user: process.env.PGUSER || 'mainflux',
  host: process.env.PGHOST || 'mqtt-db',
  database: process.env.PGDATABASE || 'subscriptions',
  password: process.env.PGPASSWORD || 'mainflux',
  port: process.env.PGPORT || 5432,
});

// Connect to the database and log connection status
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  console.log('Connected to PostgreSQL database');
  release();
});

// Query execution wrapper
const query = async (text, params) => {
  try {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Error executing query', error.stack);
    throw error;
  }
};

// Function to save sensor data
const saveSensorData = async (type, temperature, humidity, gasVolume) => {
  const text = 'INSERT INTO sensor_data (type, temperature, humidity, gas_volume, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *';
  const values = [type, temperature, humidity, gasVolume];
  
  try {
    const res = await query(text, values);
    console.log('Sensor data saved:', res.rows[0]);
    return res.rows[0];
  } catch (error) {
    console.error('Error saving sensor data:', error);
    throw error;
  }
};

// Function to check if table exists and create it if not
const initializeDatabase = async () => {
  try {
    // Check if the table exists
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sensor_data'
      );
    `;
    
    const { rows } = await query(checkTableQuery);
    const tableExists = rows[0].exists;
    
    if (!tableExists) {
      console.log('Creating sensor_data table...');
      
      // Create the table if it doesn't exist
      const createTableQuery = `
        CREATE TABLE sensor_data (
          id SERIAL PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          temperature NUMERIC,
          humidity NUMERIC,
          gas_volume NUMERIC,
          created_at TIMESTAMP NOT NULL
        );
      `;
      
      await query(createTableQuery);
      console.log('sensor_data table created successfully');
    } else {
      console.log('sensor_data table already exists');
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

module.exports = {
  query,
  saveSensorData,
  initializeDatabase,
  pool
}; 