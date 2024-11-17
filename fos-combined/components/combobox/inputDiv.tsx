// eslint-disable-next-line
/// <reference types="../../../declarations.d.ts" /> 

import React, { useEffect, useRef } from 'react';
import moduleStyles from './inputDiv.module.css';


export interface InputDivProps {
  value: string;
  onChange: (value: string, cursorPos: number | null) => void;
  onFocus?: (char: number | null) => void;
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
}

export const InputDiv: React.FC<InputDivProps> = ({
  value: fosValue,
  onChange,
  onFocus,
  onClick,
  onKeyDown,
  onKeyUp,
  onKeyPress,
  style,
  className,
  disabled,
  shouldFocus: fosHasFocus,
  placeholder,
  focusChar: fosChar,
  ...props
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  
  const inputHasFocus = divRef?.current === document.activeElement;


  const inputChar = divRef.current ? getCursorPosition(divRef.current) : undefined

  const inputValue = divRef.current ? getTextValue(divRef.current) : undefined

  const charsMatch = divRef.current ? fosChar !== inputChar : true

  const valuesMatch = divRef.current ? fosValue === inputValue : true

  const focusesMatch = divRef.current ? fosHasFocus === inputHasFocus : true


  useEffect(() => {
    if (fosHasFocus && divRef.current && !inputHasFocus) {
      console.log("GOT FOCUS -- ", "chars", charsMatch, fosChar, inputChar, "values", valuesMatch, fosValue, inputValue, "focuses", focusesMatch, fosHasFocus, inputHasFocus)
      setCursorPosition(divRef.current, fosChar || 0)
      // updateInput(fosChar || 0);
    }
    if (!fosHasFocus && divRef.current && inputHasFocus) {
      console.log("LOST FOCUS -- ", "chars", charsMatch, fosChar, inputChar, "values", valuesMatch, fosValue, inputValue, "focuses", focusesMatch, fosHasFocus, inputHasFocus)
      // updateInput(null);
    }
  }, [fosHasFocus, divRef.current, inputHasFocus]);





  // input values changed
  const updateInput = (newChar: number | null = inputChar || null) => {

    if (!divRef.current) {
      return;
    }
    const newValue = divRef.current.innerText;

    if (!fosHasFocus) {

    }

    if (!charsMatch && !valuesMatch){
      onChange(newValue, newChar);
    } else if (!charsMatch) {
      onFocus && onFocus(newChar);
    } else if (!valuesMatch) {
      onChange(newValue, newChar);
    }

  };

  // fos values changed
  const applyStateToInput = () => {
    if (!divRef.current) {
      return;
    }

    if (!charsMatch && !valuesMatch){
      setCursorPosition(divRef.current, fosChar || 0)
    } else if (!charsMatch) {
      // this should cause a re-render, so this should be applied through a useEffect 
      setCursorPosition(divRef.current, fosChar || 0)
    } else if (!valuesMatch) {
      // shouldn't have to do anything because will get re-rendered
      // divRef.current.innerText = fosValue;
    }
  }

  useEffect(() => {
    if (!divRef.current) {
      return;
    }
    if(!fosHasFocus){
      return
    }
    if (!inputHasFocus){
      return
    }
    if (!charsMatch || !valuesMatch || !focusesMatch) {
      applyStateToInput();
    }
  }, [fosValue, fosChar, fosHasFocus]); 




  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!divRef.current) {
      return;
    }
    updateInput(null);
    
  };

  const handleFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!divRef.current) {
      return;
    }
    if (!fosHasFocus) {
      const char = getCursorPosition(divRef.current);
      onFocus && onFocus(char || 0);
    }
  };



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


  }

  

  const handleKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyPress && onKeyPress(e);
    if (!divRef.current) {
      return;
    }
    // updateInput();
  };

  console.log('fosValue', fosValue, 'inputValue', inputValue, 'fosHasFocus', fosHasFocus, 'inputHasFocus', inputHasFocus)


  const dontShowPlaceholder = !!(fosValue && inputValue) || (inputHasFocus && fosHasFocus);

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
        // onInput={updateInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        // onInputCapture={updateInput}
        // onMouseUp={handleMouseUp}
        suppressContentEditableWarning={true}
        tabIndex={0}
      >
        {fosValue}
      </div>
  );
};

export default InputDiv;


const applyTextValue = (divElement: HTMLDivElement, value: string) => {
  divElement.innerText = value;
}

const getTextValue = (divElement: HTMLDivElement) => {
  return divElement.innerText;
};


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



const setCursorPosition = (divElement: HTMLDivElement, position: number | null) => {

  if (position === null) {
    const selection = window.getSelection();
    selection?.removeAllRanges();
    // document.activeElement?
  }

  const pos: number = position as number

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
