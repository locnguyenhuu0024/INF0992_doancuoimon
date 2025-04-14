const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from parent directory's .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Create PostgreSQL connection pool using environment variables
const pool = new Pool({
  user: process.env.PGUSER || 'mainflux',
  host: process.env.PGHOST || 'mqtt-db',
  database: process.env.PGDATABASE || 'subscriptions',
  password: process.env.PGPASSWORD || 'mainflux',
  port: process.env.PGPORT || 5432,
});

async function migrate() {
  let client;
  try {
    console.log('Starting database migration...');
    
    // Connect to the database
    client = await pool.connect();
    console.log('Connected to PostgreSQL database');
    
    // Check if the table exists
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sensor_data'
      );
    `;
    
    const { rows } = await client.query(checkTableQuery);
    const tableExists = rows[0].exists;
    
    if (tableExists) {
      console.log('sensor_data table already exists. Migration not required.');
    } else {
      console.log('Creating sensor_data table...');
      
      // Create the table
      const createTableQuery = `
        CREATE TABLE sensor_data (
          id SERIAL PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          temperature NUMERIC,
          humidity NUMERIC,
          gas_volume NUMERIC,
          created_at TIMESTAMP NOT NULL
        );
        
        -- Create indexes for better query performance
        CREATE INDEX idx_sensor_data_type ON sensor_data(type);
        CREATE INDEX idx_sensor_data_created_at ON sensor_data(created_at);
      `;
      
      await client.query(createTableQuery);
      console.log('sensor_data table created successfully');
    }
    
    console.log('Migration completed successfully');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  } finally {
    // Release the client
    if (client) client.release();
  }
}

// Main function to ensure proper shutdown
async function main() {
  let success = false;
  try {
    success = await migrate();
  } finally {
    try {
      // Make sure to end the pool
      await pool.end();
      console.log('Pool has ended');
    } catch (e) {
      console.error('Error ending pool:', e);
    }
    
    // Exit with appropriate code
    if (success) {
      console.log('Migration completed successfully. Exiting...');
      process.exit(0);
    } else {
      console.error('Migration failed. Exiting with error code.');
      process.exit(1);
    }
  }
}

// Run the main function
main(); 