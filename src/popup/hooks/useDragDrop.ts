import React, { useState, useCallback, useRef } from 'react';

interface DragState {
  isDragging: boolean;
  draggedId: string | null;
  draggedType: 'space' | 'tab' | null;
  sourceId: string | null;
  dropTargetId: string | null;
}

interface Position {
  x: number;
  y: number;
}

interface UseDragDropOptions {
  onDragStart?: (id: string, type: 'space' | 'tab') => void;
  onDragEnd?: (
    sourceId: string,
    targetId: string | null,
    type: 'space' | 'tab'
  ) => void;
  onDrop?: (
    draggedId: string,
    targetId: string,
    type: 'space' | 'tab'
  ) => void;
}

export function useDragDrop({
  onDragStart,
  onDragEnd,
  onDrop
}: UseDragDropOptions = {}) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedId: null,
    draggedType: null,
    sourceId: null,
    dropTargetId: null
  });

  const dragPosition = useRef<Position>({ x: 0, y: 0 });
  const initialPosition = useRef<Position>({ x: 0, y: 0 });

  // Start dragging
  const handleDragStart = useCallback((
    event: React.MouseEvent,
    id: string,
    type: 'space' | 'tab'
  ) => {
    event.preventDefault();

    // Store initial position
    initialPosition.current = {
      x: event.clientX,
      y: event.clientY
    };
    dragPosition.current = { ...initialPosition.current };

    setDragState({
      isDragging: true,
      draggedId: id,
      draggedType: type,
      sourceId: id,
      dropTargetId: null
    });

    onDragStart?.(id, type);

    // Set up document event listeners
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  }, [onDragStart]);

  // Handle drag movement
  const handleDragMove = useCallback((event: MouseEvent) => {
    if (!dragState.isDragging) return;

    dragPosition.current = {
      x: event.clientX,
      y: event.clientY
    };

    // Find drop target element under cursor
    const elementsUnderCursor = document.elementsFromPoint(
      event.clientX,
      event.clientY
    );

    const dropTarget = elementsUnderCursor.find(element => 
      element.hasAttribute('data-droppable')
    );

    if (dropTarget) {
      const targetId = dropTarget.getAttribute('data-id');
      if (targetId && targetId !== dragState.dropTargetId) {
        setDragState(prev => ({
          ...prev,
          dropTargetId: targetId
        }));
      }
    } else {
      setDragState(prev => ({
        ...prev,
        dropTargetId: null
      }));
    }
  }, [dragState.isDragging, dragState.dropTargetId]);

  // End dragging
  const handleDragEnd = useCallback((_event: MouseEvent) => {
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);

    if (dragState.dropTargetId && dragState.draggedId && dragState.draggedType) {
      onDrop?.(
        dragState.draggedId,
        dragState.dropTargetId,
        dragState.draggedType
      );
    }

    onDragEnd?.(
      dragState.sourceId!,
      dragState.dropTargetId,
      dragState.draggedType!
    );

    setDragState({
      isDragging: false,
      draggedId: null,
      draggedType: null,
      sourceId: null,
      dropTargetId: null
    });
  }, [dragState, onDrop, onDragEnd]);

  // Calculate drag overlay position and styles
  const getDragStyles = useCallback(() => {
    if (!dragState.isDragging) return null;

    const deltaX = dragPosition.current.x - initialPosition.current.x;
    const deltaY = dragPosition.current.y - initialPosition.current.y;

    return {
      transform: `translate(${deltaX}px, ${deltaY}px)`,
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: 1000,
      opacity: 0.8
    } as const;
  }, [dragState.isDragging]);

  // Utility to make an element droppable
  const makeDroppable = useCallback((id: string) => ({
    'data-droppable': true,
    'data-id': id,
    className: `droppable ${
      dragState.dropTargetId === id ? 'drop-target' : ''
    }`
  }), [dragState.dropTargetId]);

  // Utility to make an element draggable
  const makeDraggable = useCallback((
    id: string,
    type: 'space' | 'tab'
  ) => ({
    draggable: true,
    onMouseDown: (event: React.MouseEvent) => handleDragStart(event, id, type),
    className: `draggable ${
      dragState.draggedId === id ? 'dragging' : ''
    }`
  }), [dragState.draggedId, handleDragStart]);

  return {
    dragState,
    getDragStyles,
    makeDroppable,
    makeDraggable
  };
}

// Styles
const styles = `
  .draggable {
    cursor: grab;
    user-select: none;
  }

  .draggable.dragging {
    opacity: 0.5;
    cursor: grabbing;
  }

  .droppable {
    transition: background-color var(--transition-fast);
  }

  .droppable.drop-target {
    background-color: var(--background-secondary);
  }
`;

const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement);

// Example usage:
/*
const MyComponent: React.FC = () => {
  const { dragState, getDragStyles, makeDroppable, makeDraggable } = useDragDrop({
    onDragStart: (id, type) => {
      console.log(`Started dragging ${type} with id ${id}`);
    },
    onDrop: (draggedId, targetId, type) => {
      console.log(`Dropped ${type} ${draggedId} onto ${targetId}`);
    }
  });

  return (
    <div>
      <div {...makeDraggable('item1', 'space')}>
        Draggable Item 1
      </div>
      <div {...makeDroppable('zone1')}>
        Drop Zone 1
      </div>
      {dragState.isDragging && (
        <div style={getDragStyles()}>
          Drag Overlay
        </div>
      )}
    </div>
  );
};
*/
