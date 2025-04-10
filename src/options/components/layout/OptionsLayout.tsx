import React from 'react';
import { useTheme } from '../../../popup/styles/ThemeProvider';
import { useImportExportService } from '../../hooks/useImportExportService';
import ImportExport from '../import-export/ImportExport';
import GeneralSettings from '../general/GeneralSettings';
import {
  LayoutContainer,
  Header,
  HeaderTitle,
  Main,
  Section,
  Footer,
  FooterText
} from './OptionsLayout.styles';

interface OptionsLayoutProps {
  children: React.ReactNode;
}

const OptionsLayout: React.FC<OptionsLayoutProps> = ({ children }) => {
  const { isDark } = useTheme();
  const importExportService = useImportExportService();

  return (
    <LayoutContainer className={isDark ? 'dark' : 'light'}>
      <Header>
        <HeaderTitle>Chrome Spaces Settings</HeaderTitle>
      </Header>
      <Main>
        <Section aria-labelledby="general-settings-heading">
          <GeneralSettings />
        </Section>
        
        {importExportService && (
          <Section aria-labelledby="import-export-heading">
            <h2 id="import-export-heading">Import and Export Spaces</h2>
            <ImportExport importExportService={importExportService} />
          </Section>
        )}
      </Main>
      <Footer>
        <FooterText>Chrome Spaces © {new Date().getFullYear()}</FooterText>
      </Footer>
    </LayoutContainer>
  );
};

export default OptionsLayout;