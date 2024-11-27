import React, { useState } from 'react';



export const TripleToggleSwitch = ({ 
  defaultValue = 0, 
  onValueChange, 
  labels = ['Off', 'Partial', 'On'] 
} : {
  defaultValue?: number,
  onValueChange?: (value: number) => void,
  labels?: string[]
}) => {
  const [value, setValue] = useState(defaultValue);

  const handleClick = () => {
    const nextValue = (value + 1) % 3;
    setValue(nextValue);
    onValueChange?.(nextValue);
  };

  const getBackgroundColor = () => {
    switch (value) {
      case 0:
        return 'bg-gray-200';
      case 1:
        return 'bg-blue-400';
      case 2:
        return 'bg-blue-600';
      default:
        return 'bg-gray-200';
    }
  };

  const getThumbPosition = () => {
    switch (value) {
      case 0:
        return 'left-0.5';
      case 1:
        return 'left-[2.75rem]';
      case 2:
        return 'left-[5rem]';
      default:
        return 'left-0.5';
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`relative h-6 w-24 cursor-pointer rounded-full transition-colors ${getBackgroundColor()}`}
        role="switch"
        aria-checked={value === 2}
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick();
          }
        }}
      >
        <div
          className={`absolute top-0.5 h-5 w-5 transform rounded-full bg-white shadow-md transition-all duration-200 ${getThumbPosition()}`}
        />
      </div>
      <div className="flex w-24 justify-between text-sm">
        {labels.map((label, index) => (
          <span
            key={label}
            className={`cursor-pointer ${value === index ? 'font-medium text-blue-600' : 'text-gray-500'}`}
            onClick={() => {
              setValue(index);
              onValueChange?.(index);
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default TripleToggleSwitch;