import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    config.resolve.alias['@'] = path.resolve(__dirname, 'app');
    config.resolve.alias['@components'] = path.resolve(__dirname, 'components');
    config.resolve.alias['@hooks'] = path.resolve(__dirname, 'hooks');
    return config;
  }
};

export default nextConfig;
