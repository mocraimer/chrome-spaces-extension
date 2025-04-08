import React, { useState, useRef } from 'react';
import { SpaceImportExportService } from '../../../background/services/SpaceImportExportService';
import { ImportResult } from '../../../shared/types/ImportExport';
import {
  Container,
  ButtonGroup,
  Button,
  FeedbackMessage,
  LoadingIndicator,
  FeedbackType
} from './ImportExport.styles';

interface ImportExportProps {
  importExportService: SpaceImportExportService;
}

export const ImportExport: React.FC<ImportExportProps> = ({ importExportService }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: FeedbackType; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setFeedback(null);

    try {
      // First validate the file
      const validationResult = await importExportService.validateImportFile(file);
      if (!validationResult.success) {
        throw new Error(validationResult.errors?.[0]?.message || 'Invalid import file');
      }

      // Proceed with import
      const result: ImportResult = await importExportService.importFromFile(file);
      
      if (result.success) {
        const { active, closed } = result.imported;
        setFeedback({
          type: 'success',
          message: `Successfully imported ${active} active and ${closed} closed spaces`
        });
      } else {
        throw new Error(result.errors?.[0]?.message || 'Import failed');
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to import spaces'
      });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExport = async () => {
    setIsLoading(true);
    setFeedback(null);

    try {
      await importExportService.exportToFile();
      setFeedback({
        type: 'success',
        message: 'Spaces exported successfully'
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to export spaces'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <ButtonGroup>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImport}
          accept=".json"
          style={{ display: 'none' }}
          aria-label="Import spaces from file"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? <LoadingIndicator /> : 'Import Spaces'}
        </Button>
        <Button
          onClick={handleExport}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? <LoadingIndicator /> : 'Export Spaces'}
        </Button>
      </ButtonGroup>
      
      {feedback && (
        <FeedbackMessage
          type={feedback.type}
          role={feedback.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {feedback.message}
        </FeedbackMessage>
      )}
    </Container>
  );
};

export default ImportExport;