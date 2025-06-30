import { Button } from '@mui/material';
import { FileDownload as FileDownloadIcon } from '@mui/icons-material';
import React from 'react';
import { saveAs } from 'file-saver';
import api from '../services/api';

interface Column {
  id: string;
  label: string;
  format?: (value: any) => string;
}

interface ExportButtonProps {
  data?: any[];
  columns?: Column[];
  title: string;
  defaultFileName: string;
  filter?: any;
  endpoint?: string;
  filters?: Record<string, any>;
}

const ExportButton: React.FC<ExportButtonProps> = ({ 
  data, 
  columns, 
  title, 
  defaultFileName,
  filter,
  endpoint,
  filters
}) => {
  const handleExport = async () => {
    // If endpoint is provided, use API export
    if (endpoint) {
      try {
        // Build query params
        const params = new URLSearchParams();
        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              params.append(key, value.toString());
            }
          });
        }
        
        // Make API request
        const response = await api.get(`${endpoint}?${params.toString()}`, {
          responseType: 'blob'
        });
        
        // Create file and trigger download
        const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${defaultFileName}_${new Date().toISOString().split('T')[0]}.csv`);
        return;
      } catch (error) {
        console.error('Export failed:', error);
        return;
      }
    }
    
    // If no endpoint or API call failed, fall back to client-side export
    if (!data || !data.length) return;
    
    // Filter data if filter is provided
    let filteredData = [...data];
    if (filter?.dateRange) {
      filteredData = filteredData.filter(item => {
        const date = new Date(item.sent_at || item.created_at);
        return (
          date >= new Date(filter.dateRange.start) &&
          date <= new Date(filter.dateRange.end)
        );
      });
    }
    
    // Format data according to columns
    const csvContent = [
      columns.map(col => `"${col.label}"`).join(','),
      ...filteredData.map(row => 
        columns.map(col => {
          // Handle nested properties with dot notation
          const value = col.id.split('.').reduce((obj, key) => 
            (obj && obj[key] !== undefined) ? obj[key] : '', row);
            
          // Apply formatting if specified
          const formattedValue = col.format ? col.format(value) : value;
          
          // Handle special characters and wrap in quotes if needed
          if (formattedValue === null || formattedValue === undefined) return '';
          const stringValue = String(formattedValue);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      ),
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${defaultFileName}_${new Date().toISOString().split('T')[0]}.csv`);
  };
  return (
    <Button
      variant="outlined"
      startIcon={<FileDownloadIcon />}
      onClick={handleExport}
      sx={{ whiteSpace: 'nowrap' }}
    >
      Export
    </Button>
  );
};

export default ExportButton;
