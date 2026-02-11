import React, { createContext, useContext, useState, useEffect } from 'react';
import { pb } from '../lib/pocketbase';

export type UserRole = 'USER' | 'ADMIN' | 'ALMC' | 'TRA' | 'CE' | 'DCA';

interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatar?: string;
    status?: 'Online' | 'Ausente' | 'Ocupado' | 'Offline';
    phone?: string;
    sector?: string;
    observations?: string;
}

export const SECTORS = [
    'CENTRO DE ESTUDOS', 'CGA', 'DAPS', 'DICA', 'DIL', 'DRH', 'DVS', 'GABINETE', 'OUVIDORIA', 'OUTROS'
] as const;

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (data: { name: string; email: string; password: string; sector: string; role?: UserRole }) => Promise<{ needsVerification: boolean }>;
    logout: () => void;
    updateProfile: (data: Partial<User>) => Promise<void>;
    updateStatus: (status: User['status']) => Promise<void>;
    setRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    // Local override for dev role switching
    const [devRoleOverride, setDevRoleOverride] = useState<UserRole | null>(null);

    useEffect(() => {
        console.log('AuthContext: Initializing sync...', { 
            isValid: pb.authStore.isValid, 
            model: pb.authStore.model?.id,
            collection: pb.authStore.model?.collectionName 
        });
        
        // Sync user state with PocketBase auth store
        const syncUser = () => {
            try {
                if (pb.authStore.isValid && pb.authStore.model) {
                    const model = pb.authStore.model;
                    
                    // Validate that the user belongs to the correct collection
                    if (model.collectionName !== 'agenda_cap53_usuarios') {
                        console.warn('User logged in with wrong collection (' + model.collectionName + '). Logging out.');
                        pb.authStore.clear();
                        setUser(null);
                        setDevRoleOverride(null);
                        setLoading(false);
                        return;
                    }

                    console.log('AuthContext: Setting user state for:', model.email);
                    setUser({
                        id: model.id,
                        name: model.name || '',
                        email: model.email,
                        role: devRoleOverride || (model.role as UserRole),
                        avatar: model.avatar ? pb.files.getUrl(model, model.avatar) : undefined,
                        status: model.status,
                        phone: model.phone,
                        sector: model.sector,
                        observations: model.observations,
                    });
                } else {
                    console.log('AuthContext: No valid session found');
                    setUser(null);
                    setDevRoleOverride(null); // Reset override on logout
                }
            } catch (error) {
                console.error('AuthContext: Error during syncUser:', error);
            } finally {
                setLoading(false);
            }
        };

        syncUser();

        // Listen to auth changes
        const unsubscribe = pb.authStore.onChange(() => {
            console.log('AuthContext: Auth store changed');
            syncUser();
        });

        return () => {
            unsubscribe();
        };
    }, [devRoleOverride]);

    const login = async (email: string, password: string) => {
        try {
            await pb.collection('agenda_cap53_usuarios').authWithPassword(email, password);
        } catch (error: any) {
            console.error('Login error:', error);
            
            // Check if error is due to unverified email
            if (error.status === 400 && error.data?.message?.includes('verified')) {
                throw new Error('Sua conta ainda não foi verificada. Por favor, verifique seu e-mail.');
            }
            
            throw error;
        }
    };

    const register = async (data: { name: string; email: string; password: string; sector: string; role?: UserRole }) => {
        try {
            const createData = {
                name: data.name,
                email: data.email,
                password: data.password,
                passwordConfirm: data.password,
                sector: data.sector,
                role: data.role || 'USER',
                status: 'Online'
            };
            
            // 1. Create the user
            await pb.collection('agenda_cap53_usuarios').create(createData);
            
            // 2. Request verification email
            try {
                await pb.collection('agenda_cap53_usuarios').requestVerification(data.email);
                console.log('Verification email requested for:', data.email);
            } catch (verifyError) {
                console.warn('Failed to send verification email:', verifyError);
                // We continue because the user was created successfully
            }

            // 3. Try to login (this might fail if onlyVerified is true)
            try {
                await login(data.email, data.password);
                return { needsVerification: false };
            } catch (loginError: any) {
                console.log('Post-registration login failed (likely due to verification requirement):', loginError.message);
                return { needsVerification: true };
            }
        } catch (error: any) {
            console.error('Registration error:', error);
            if (error.data?.data?.email?.code === 'validation_not_unique') {
                throw new Error('Este e-mail já está em uso.');
            }
            throw error;
        }
    };

    const logout = () => {
        pb.authStore.clear();
    };

    const updateProfile = async (data: Partial<User>) => {
        if (!user || !pb.authStore.model) return;
        
        const collectionName = pb.authStore.model.collectionName;
        console.log('Updating profile for user ID:', user.id, 'in collection:', collectionName, 'with data:', data);

        try {
            await pb.collection(collectionName).update(user.id, {
                ...data
            });
            // Refresh auth store to ensure local model is updated and onChange fires
            await pb.collection(collectionName).authRefresh();
        } catch (error) {
            console.error('Profile update error details:', error);
            throw error;
        }
    };

    const updateStatus = async (status: User['status']) => {
        await updateProfile({ status });
    };

    const setRole = async (role: UserRole) => {
        // Optimistic / Local Dev Override
        setDevRoleOverride(role);
        
        try {
            await updateProfile({ role });
        } catch (error) {
            console.warn('Failed to persist role change to DB (using local override):', error);
            // We suppress the error here so the UI still updates for the user
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile, updateStatus, setRole }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
