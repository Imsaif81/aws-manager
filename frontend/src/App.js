import React, { useState, useEffect } from 'react';
import './App.css'; // Import Tailwind CSS
import axios from 'axios';

const App = () => {
  const [slots, setSlots] = useState({
    accessKeyId: '',
    secretAccessKey: '',
    region: 'us-east-1',
  });
  
  const [createdIPs, setCreatedIPs] = useState([]);
  const [allocatedIPs, setAllocatedIPs] = useState([]);
  const [releasedIPs, setReleasedIPs] = useState([]);
  
  const [createdCount, setCreatedCount] = useState(0);
  const [allocatedCount, setAllocatedCount] = useState(0);
  const [releasedCount, setReleasedCount] = useState(0);
  
  const [isProcessing, setIsProcessing] = useState(false);
  
  const regions = ['us-east-1', 'us-west-2', 'ap-south-1', 'eu-west-1'];

  const handleInputChange = (field, value) => {
    setSlots({ ...slots, [field]: value });
  };

  const startProcess = async () => {
    if (!slots.accessKeyId || !slots.secretAccessKey || !slots.region) {
      alert('Please fill in all fields.');
      return;
    }
    
    setIsProcessing(true);

    try {
      const response = await axios.post('http://13.233.229.1:5000/api/allocate-ip', {
        accessKeyId: slots.accessKeyId,
        secretAccessKey: slots.secretAccessKey,
        region: slots.region,
      });

      updateStatus(response.data);
    } catch (error) {
      console.error(error);
      alert('An error occurred during IP allocation');
    } finally {
      setIsProcessing(false);
    }
  };

  const updateStatus = (data) => {
    setCreatedIPs(data.createdIPs);
    setAllocatedIPs(data.allocatedIPs);
    setReleasedIPs(data.releasedIPs);

    setCreatedCount(data.createdIPs.length);
    setAllocatedCount(data.allocatedIPs.length);
    setReleasedCount(data.releasedIPs.length);
  };

  // Polling the status API every 5 seconds to get real-time updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await axios.get('http://13.233.229.1:5000/api/status');
        updateStatus(response.data);
      } catch (error) {
        console.error("Error fetching status:", error);
      }
    }, 5000);

    return () => clearInterval(interval); // Cleanup the interval on component unmount
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-8">
      <h1 className="text-4xl font-bold mb-8 text-gray-800">AWS Elastic IP Manager</h1>

      <div className="w-full max-w-lg bg-white shadow-md rounded-lg p-6">
        <input
          type="text"
          placeholder="AWS Access Key ID"
          value={slots.accessKeyId}
          onChange={(e) => handleInputChange('accessKeyId', e.target.value)}
          className="block w-full border border-gray-300 rounded-md mb-4 p-2 focus:outline-none focus:ring focus:ring-blue-300"
        />
        <input
          type="password"
          placeholder="AWS Secret Access Key"
          value={slots.secretAccessKey}
          onChange={(e) => handleInputChange('secretAccessKey', e.target.value)}
          className="block w-full border border-gray-300 rounded-md mb-4 p-2 focus:outline-none focus:ring focus:ring-blue-300"
        />
        <select
          value={slots.region}
          onChange={(e) => handleInputChange('region', e.target.value)}
          className="block w-full border border-gray-300 rounded-md mb-4 p-2 focus:outline-none focus:ring focus:ring-blue-300"
        >
          {regions.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>

        <button
          onClick={startProcess}
          className={`w-full py-3 rounded-md text-white font-semibold ${isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'} focus:outline-none focus:ring-2 focus:ring-blue-300`}
          disabled={isProcessing}
        >
          {isProcessing ? 'Processing...' : 'Start Allocation'}
        </button>
      </div>

      <div className="mt-8 w-full grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl">
        {/* Created IPs Box */}
        <div className="bg-white shadow-md rounded-lg p-4 h-64 overflow-y-auto">
          <h2 className="text-xl font-semibold mb-2 text-gray-700">Created IPs ({createdCount})</h2>
          <ul className="list-disc ml-5">
            {createdIPs.map((ip, index) => (
              <li key={index} className="text-gray-600">{ip}</li>
            ))}
          </ul>
        </div>

        {/* Allocated IPs Box */}
        <div className="bg-white shadow-md rounded-lg p-4 h-64 overflow-y-auto">
          <h2 className="text-xl font-semibold mb-2 text-gray-700">Allocated IPs ({allocatedCount})</h2>
          <ul className="list-disc ml-5">
            {allocatedIPs.map((ip, index) => (
              <li key={index} className="text-green-600">{ip}</li>
            ))}
          </ul>
        </div>

        {/* Released IPs Box */}
        <div className="bg-white shadow-md rounded-lg p-4 h-64 overflow-y-auto">
          <h2 className="text-xl font-semibold mb-2 text-gray-700">Released IPs ({releasedCount})</h2>
          <ul className="list-disc ml-5">
            {releasedIPs.map((ip, index) => (
              <li key={index} className="text-red-600">{ip}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default App;
