require('dotenv').config();

const shared = {
  dialect: 'postgres',
  logging: false,
  define: {
    underscored: true,
    freezeTableName: true,
  },
};

function connection(databaseName, urlVariable = 'DATABASE_URL') {
  if (process.env[urlVariable]) {
    return {
      ...shared,
      use_env_variable: urlVariable,
      dialectOptions:
        process.env.NODE_ENV === 'production'
          ? { ssl: { require: true, rejectUnauthorized: false } }
          : undefined,
    };
  }

  return {
    ...shared,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || databaseName,
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
  };
}

module.exports = {
  development: connection('database_apps_findyourfitshoes'),
  test: connection('database_test_apps_findyourfitshoes', 'TEST_DATABASE_URL'),
  production: connection('soleswap'),
};
