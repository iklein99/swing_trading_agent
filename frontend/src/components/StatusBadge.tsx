/**
 * Status Badge Component
 * Displays status with appropriate color coding
 */

interface StatusBadgeProps {
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE' | 'RUNNING' | 'STOPPED' | 'PAUSED';
  label?: string;
}

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'HEALTHY':
      case 'RUNNING':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'WARNING':
      case 'PAUSED':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'OFFLINE':
      case 'STOPPED':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor()}`}
    >
      <span className="w-2 h-2 mr-2 rounded-full bg-current opacity-75"></span>
      {label || status}
    </span>
  );
}
