import { NextApiRequest, NextApiResponse } from 'next';

// Mock data for development
const mockTargetLists = [
  {
    id: '1',
    name: 'Sample Target List',
    description: 'This is a sample target list',
    contactCount: 0,
    status: 'active',
    updatedAt: new Date().toISOString(),
  },
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Return the list of target lists
    return res.status(200).json(mockTargetLists);
  } else if (req.method === 'POST') {
    // Handle creating a new target list
    const { name, description } = req.body;
    const newList = {
      id: Date.now().toString(),
      name,
      description,
      contactCount: 0,
      status: 'active',
      updatedAt: new Date().toISOString(),
    };
    mockTargetLists.push(newList);
    return res.status(201).json(newList);
  }

  // Method not allowed
  return res.status(405).json({ message: 'Method not allowed' });
}
