// eslint-disable-next-line
/// <reference types="../../global.d.ts" /> 

import React, { useEffect, useRef } from 'react';
import moduleStyles from './inputDiv.module.css';


export interface InputDivProps {
  value: string;
  onChange: (value: string, cursorPos: number) => void;
  onFocus?: (char: number) => void;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onKeyUp?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onKeyPress?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
  shouldFocus?: boolean;
  placeholder: string;
  focusChar?: number | null;
  getFocus: () => void;
}

export const InputDiv: React.FC<InputDivProps> = ({
  value,
  onChange,
  onFocus,
  onClick,
  onKeyDown,
  onKeyUp,
  onKeyPress,
  style,
  className,
  disabled,
  shouldFocus,
  placeholder,
  focusChar,
  getFocus,
  ...props
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  
  const hasFocus = divRef?.current === document.activeElement;

  useEffect(() => {
    if (shouldFocus && divRef.current && !hasFocus) {
      // console.log("GOT FOCUS -- ", value)
      setCursorPosition(divRef.current, focusChar || 0)
      onFocus && onFocus(focusChar || 0);
    }
  }, [shouldFocus, divRef.current, hasFocus]);


  // const focusChar = divRef.current ? getCursorPosition(divRef.current) : 0;

  // useEffect(() => {

  // }, [hasFocus, focusChar])


  useEffect(() => {
    if(!shouldFocus){
      return
    }
    if (!hasFocus){
      return
    }
    if(!divRef.current){
      return 
    }
    // console.log('setting cursor position', focusChar)
    onFocus && onFocus(focusChar || 0);
    setCursorPosition(divRef.current, focusChar || 0)
  }, [focusChar]);

  const updateInput = () => {

    if (!divRef.current) {
      return;
    }
    const cursorPosition = getCursorPosition(divRef.current);
    const newValue = divRef.current.innerText;
    onChange(newValue, cursorPosition);
    // console.log('updateInput')
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {

    updateInput();
  };

  const handleFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!divRef.current) {
      return;
    }
    updateInput();
  };

  
  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) {
      return;
    }
    getFocus();
    updateInput();
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown && onKeyDown(e);
    if (!divRef.current) {
      return;
    }    
    if (e.key === 'Enter') {
      e.stopPropagation();
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
      }
      return
    }
    // updateInput();
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyUp && onKeyUp(e);
    if (!divRef.current) {
      return;
    }
    if (e.key === 'Enter') {
      e.stopPropagation();
      return
    }
    console.log('keyup', e.key)
    updateInput();
    // console.log('keyup', e.key, hasFocus, focusChar, value, divRef.current ? textNodes(divRef.current) : '--', textNodes(divRef.current).length)
  }

  

  const handleKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyPress && onKeyPress(e);
    if (!divRef.current) {
      return;
    }
    // updateInput();
  };



  const dontShowPlaceholder = !!value || hasFocus;

  const placeholderClassName = dontShowPlaceholder ? moduleStyles.inputDiv : moduleStyles.emptyInputDiv
  // console.log('dontShowPlaceholder', dontShowPlaceholder, value, hasFocus, divRef.current?.innerText)
  

  return (
      <div
        ref={divRef}
        contentEditable={!disabled}
        data-placeholder={placeholder}
        className={`h-full w-full border-none  ${placeholderClassName} ${className}`}
        style={{
          ...moduleStyles,
          position: 'relative',
          wordWrap: 'break-word',
          maxWidth: '100%',
          whiteSpace: 'pre-wrap',
          ...(style || {}),
        }}
        onInput={updateInput}
        onFocus={handleFocus}
        // onBlur={handleBlur}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        // onInputCapture={updateInput}
        // onMouseUp={handleMouseUp}
        suppressContentEditableWarning={true}
        tabIndex={0}
      >
        {value}
      </div>
  );
};

export default InputDiv;


const textNodes = (divElement: HTMLDivElement) => {
  const iterator = document.createNodeIterator(
    divElement,
    NodeFilter.SHOW_TEXT,
    null,
  );
  const list = [];
  for (let node = iterator.nextNode(); node; node = iterator.nextNode()) {
    // console.log(node.textContent);
    list.push(node);
  }
  return list
}


const getCursorPosition = (divElement: HTMLDivElement) => {


  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    console.warn('selection is null or rangeCount is 0');
    return 0;
  }

  let cursorPosition = 0;
  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(divElement);
  preCaretRange.setEnd(range.endContainer, range.endOffset);

  const iterator = document.createNodeIterator(
    divElement,
    NodeFilter.SHOW_TEXT,
    null,
  );

  let currentNode;
  while ((currentNode = iterator.nextNode())) {
    if (currentNode === range.endContainer) {
      cursorPosition += range.endOffset;
      break;
    } else {
      cursorPosition += currentNode.textContent?.length ?? 0;
    }
  }

  return cursorPosition;
};



const setCursorPosition = (divElement: HTMLDivElement, pos: number) => {
  const range = document.createRange();
  const selection = window.getSelection();
  
  const iterator = document.createNodeIterator(
    divElement,
    NodeFilter.SHOW_TEXT,
    null,
  );
  
  let currentNode;
  let currentPos = 0;
  while ((currentNode = iterator.nextNode())) {
    const nodeLength = currentNode.textContent?.length ?? 0;
    if (currentPos + nodeLength >= pos) {

      range.setStart(currentNode, pos - currentPos);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    currentPos += nodeLength;
  }
  // If position is out of bounds, place cursor at the end
  range.setStart(divElement, divElement.childNodes.length);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);
};
