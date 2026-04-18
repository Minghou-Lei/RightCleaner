import { render, screen } from '@testing-library/react';
import { OverviewPanel } from '@/features/dashboard/components/OverviewPanel';

describe('OverviewPanel', () => {
  it('renders the provided content', () => {
    render(<OverviewPanel title="工程基线" description="统一工具链已配置。" />);

    expect(screen.getByRole('heading', { name: '工程基线' })).toBeInTheDocument();
    expect(screen.getByText('统一工具链已配置。')).toBeInTheDocument();
  });
});
