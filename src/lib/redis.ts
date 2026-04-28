import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;

class RedisClient {
  private static instance: Redis;

  public static getInstance(): Redis {
    if (!this.instance) {
      if (!REDIS_URL) {
        console.warn('REDIS_URL not found, using localhost:6379');
      }
      this.instance = new Redis(REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: null,
      });
    }
    return this.instance;
  }
}

export default RedisClient.getInstance();
