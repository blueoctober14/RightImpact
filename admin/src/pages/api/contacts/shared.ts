import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    // Get the API URL from environment variables
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    
    // Forward the request to the backend API
    const response = await axios({
      method: req.method,
      url: `${apiBaseUrl}/contacts/shared`,
      headers: {
        ...(req.headers.authorization && { Authorization: req.headers.authorization }),
        'Content-Type': 'application/json',
      },
      params: req.query,
      data: req.body,
    });

    // Send the response back to the client
    res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('API route error:', error);
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || 'Internal server error';
    res.status(status).json({ message });
  }
};

export default handler;
