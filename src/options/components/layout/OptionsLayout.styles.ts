import styled from 'styled-components';

export const LayoutContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--background-primary);
  color: var(--text-primary);
`;

export const Header = styled.header`
  padding: var(--spacing-lg) var(--spacing-xl);
  border-bottom: 1px solid var(--border-color);
  background-color: var(--background-secondary);
`;

export const HeaderTitle = styled.h1`
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
`;

export const Main = styled.main`
  flex: 1;
  padding: var(--spacing-xl);
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
`;

export const Section = styled.section`
  margin: var(--spacing-xl) 0;

  &:first-child {
    margin-top: 0;
  }

  &:last-child {
    margin-bottom: 0;
  }

  h2 {
    margin: 0 0 var(--spacing-lg);
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
`;

export const Footer = styled.footer`
  padding: var(--spacing-md) var(--spacing-xl);
  text-align: center;
  border-top: 1px solid var(--border-color);
  background-color: var(--background-secondary);
`;

export const FooterText = styled.p`
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
`;