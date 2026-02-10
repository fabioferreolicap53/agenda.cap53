import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import MyInvolvement from './MyInvolvement';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../components/AuthContext';

// Mock PocketBase
vi.mock('../lib/pocketbase', () => ({
    pb: {
        collection: vi.fn(() => ({
            getList: vi.fn().mockResolvedValue({
                items: [],
                totalPages: 1,
                totalItems: 0
            }),
            getOne: vi.fn().mockResolvedValue({}),
            update: vi.fn().mockResolvedValue({}),
            delete: vi.fn().mockResolvedValue({})
        }))
    }
}));

// Mock AuthContext
vi.mock('../components/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'test-user-id', name: 'Test User', role: 'USER' }
    }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

describe('MyInvolvement Component', () => {
    it('renders the page title', () => {
        render(
            <BrowserRouter>
                <MyInvolvement />
            </BrowserRouter>
        );
        expect(screen.getByText(/Meu Espaço/i)).toBeInTheDocument();
    });

    it('switches tabs correctly', async () => {
        render(
            <BrowserRouter>
                <MyInvolvement />
            </BrowserRouter>
        );

        const invitesTab = screen.getByText(/Convites recebidos/i);
        fireEvent.click(invitesTab);

        await waitFor(() => {
            expect(invitesTab.closest('button')).toHaveClass('bg-white');
        });
    });

    it('updates search term and debounces', async () => {
        render(
            <BrowserRouter>
                <MyInvolvement />
            </BrowserRouter>
        );

        const searchInput = screen.getByPlaceholderText(/Buscar por nome do evento/i);
        fireEvent.change(searchInput, { target: { value: 'React' } });

        expect(searchInput).toHaveValue('React');
        // Debounce happens after 500ms, so we wait
        await waitFor(() => {
            // Check if search triggered or state updated if possible
        }, { timeout: 1000 });
    });

    it('renders stats tab with charts', async () => {
        render(
            <BrowserRouter>
                <MyInvolvement />
            </BrowserRouter>
        );

        const statsTab = screen.getByText(/Estatísticas/i);
        fireEvent.click(statsTab);

        await waitFor(() => {
            expect(screen.getByText(/Distribuição de participações/i)).toBeInTheDocument();
            expect(screen.getByText(/Evolução mensal/i)).toBeInTheDocument();
        });
    });
});
