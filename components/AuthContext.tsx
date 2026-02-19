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
    context_status?: string;
    last_active?: string;
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
    isSidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    login: (email: string, password: string) => Promise<void>;
    register: (data: { name: string; email: string; password: string; sector: string; role?: UserRole }) => Promise<{ needsVerification: boolean }>;
    logout: () => void;
    updateProfile: (data: Partial<User>) => Promise<void>;
    updateAvatar: (file: File) => Promise<void>;
    updateStatus: (status: User['status'], contextStatus?: string) => Promise<void>;
    setRole: (role: UserRole) => Promise<void>;
    requestPasswordReset: (email: string) => Promise<void>;
    confirmPasswordReset: (token: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const translateError = (error: any): string => {
    const message = error?.message || '';
    const status = error?.status;
    const data = error?.data?.data || {};

    console.log('Translating error:', { message, status, data });

    // PocketBase common error messages
    if (message.includes('Failed to authenticate')) {
        return 'Falha na autenticação. E-mail ou senha incorretos.';
    }

    if (message.includes('The requested resource wasn\'t found')) {
        return 'Recurso não encontrado.';
    }

    if (message.includes('Something went wrong while processing your request')) {
        return 'Ocorreu um erro no servidor. Tente novamente mais tarde.';
    }

    if (message.toLowerCase().includes('email is already in use')) {
        return 'Este e-mail já está sendo utilizado por outra conta.';
    }

    if (message.toLowerCase().includes('identity is already in use')) {
        return 'Este usuário já está sendo utilizado.';
    }

    // Validation errors (400)
    if (status === 400) {
        if (data.email?.code === 'validation_not_unique') {
            return 'Este e-mail já está em uso.';
        }
        if (data.password?.code === 'validation_length_out_of_range') {
            return 'A senha deve ter pelo menos 8 caracteres.';
        }
        if (message.includes('verified')) {
            return 'Sua conta ainda não foi verificada. Por favor, verifique seu e-mail.';
        }
        
        // Handle field-specific validation errors if available
        const fields = Object.keys(data);
        if (fields.length > 0) {
            const firstField = fields[0];
            const fieldError = data[firstField];
            if (firstField === 'passwordConfirm') return 'As senhas não coincidem.';
            if (firstField === 'email') return 'E-mail inválido.';
            return `Erro no campo ${firstField}: ${fieldError.message || fieldError.code}`;
        }

        return 'Dados inválidos. Verifique as informações fornecidas.';
    }

    if (status === 403) {
        return 'Você não tem permissão para realizar esta ação.';
    }

    if (status === 404) {
        return 'Usuário ou recurso não encontrado.';
    }

    if (status === 0 || message.includes('NetworkError') || message.includes('Failed to fetch')) {
        return 'Erro de conexão. Verifique sua internet.';
    }

    return 'Ocorreu um erro inesperado. Tente novamente mais tarde.';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    // Local override for dev role switching
    const [devRoleOverride, setDevRoleOverride] = useState<UserRole | null>(null);
    
    const lastActiveUpdateRef = React.useRef<number>(Date.now());
    const idleTimerRef = React.useRef<NodeJS.Timeout | null>(null);

    // Auto-Away and Activity Tracking
    useEffect(() => {
        if (!user) return;

        const IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes
        const ACTIVITY_THROTTLE = 60 * 1000; // 1 minute throttle for DB updates

        const handleActivity = () => {
            const now = Date.now();
            
            // 1. Reset Idle Timer logic
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            
            // If user is currently Online, set a timer to switch to Ausente
            if (user.status === 'Online') {
                idleTimerRef.current = setTimeout(() => {
                    console.log('User idle for 10min, setting to Ausente');
                    updateStatus('Ausente');
                }, IDLE_TIMEOUT);
            }

            // 2. Return from Auto-Away
            // If user was Away and interacts, set back to Online
            if (user.status === 'Ausente') {
                 updateStatus('Online');
            }

            // 3. Update last_active in DB (Throttled)
            if (now - lastActiveUpdateRef.current > ACTIVITY_THROTTLE) {
                lastActiveUpdateRef.current = now;
                if (pb.authStore.model) {
                    pb.collection(pb.authStore.model.collectionName).update(user.id, {
                        last_active: new Date().toISOString()
                    }).catch(err => console.error('Failed to update last_active:', err));
                }
            }
        };

        // Initial setup
        if (user.status === 'Online') {
             if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
             idleTimerRef.current = setTimeout(() => {
                updateStatus('Ausente');
            }, IDLE_TIMEOUT);
        }

        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
        events.forEach(event => window.addEventListener(event, handleActivity));

        return () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            events.forEach(event => window.removeEventListener(event, handleActivity));
        };
    }, [user?.id, user?.status]);

    // Handle window close / disconnect
    useEffect(() => {
        const handleUnload = () => {
            if (user?.id && user?.status !== 'Offline') {
                // Best effort to set offline
                updateStatus('Offline');
            }
        };
        
        window.addEventListener('beforeunload', handleUnload);
        return () => window.removeEventListener('beforeunload', handleUnload);
    }, [user?.id, user?.status]);

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
                        last_active: model.last_active,
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
            // Update status to Online on login
            if (pb.authStore.model) {
                await pb.collection('agenda_cap53_usuarios').update(pb.authStore.model.id, {
                    status: 'Online',
                    last_active: new Date().toISOString()
                });
            }
        } catch (error: any) {
            console.error('Login error:', error);
            throw new Error(translateError(error));
        }
    };

    const register = async (data: { name: string; email: string; password: string; sector: string; role?: UserRole }) => {
        try {
            // Basic validation
            if (data.password.length < 8) {
                throw new Error('A senha deve ter pelo menos 8 caracteres.');
            }

            // Generate a clean username (alphanumeric only)
            let emailPrefix = data.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
            if (!emailPrefix) emailPrefix = 'user';
            const randomSuffix = Math.floor(Math.random() * 100000);
            const username = `${emailPrefix}${randomSuffix}`;

            const createData: any = {
                    username,
                    name: data.name,
                    email: data.email,
                    password: data.password,
                    passwordConfirm: data.password,
                    sector: data.sector,
                    role: data.role || 'USER',
                    status: 'Online',
                    emailVisibility: true
                };
            
            console.log('Attempting to create user with data:', { ...createData, password: '***', passwordConfirm: '***' });
            
            // 1. Create the user
            try {
                await pb.collection('agenda_cap53_usuarios').create(createData);
            } catch (createError: any) {
                console.error('PocketBase Create User Error:', createError);
                throw new Error(translateError(createError));
            }
            
            // 2. Request verification email
            try {
                await pb.collection('agenda_cap53_usuarios').requestVerification(data.email);
                console.log('Verification email requested for:', data.email);
            } catch (verifyError) {
                console.warn('Failed to send verification email:', verifyError);
            }

            // 3. Try to login
            try {
                await login(data.email, data.password);
                return { needsVerification: false };
            } catch (loginError: any) {
                console.log('Post-registration login failed:', loginError.message);
                // If login fails after creation, it's likely because verification is required
                return { needsVerification: true };
            }
        } catch (error: any) {
            console.error('Registration flow error:', error);
            if (error.message?.includes('verificada') || error.message?.includes('uso') || error.message?.includes('caracteres')) {
                throw error;
            }
            throw new Error(translateError(error));
        }
    };

    const logout = async () => {
        if (pb.authStore.model) {
            try {
                await pb.collection('agenda_cap53_usuarios').update(pb.authStore.model.id, {
                    status: 'Offline',
                    last_active: new Date().toISOString()
                });
            } catch (e) {
                console.error('Error setting offline status on logout', e);
            }
        }
        pb.authStore.clear();
        setUser(null);
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

    const updateAvatar = async (file: File) => {
        if (!user || !pb.authStore.model) return;
        
        const collectionName = pb.authStore.model.collectionName;
        console.log('Updating avatar for user ID:', user.id, 'in collection:', collectionName);

        try {
            const formData = new FormData();
            formData.append('avatar', file);

            await pb.collection(collectionName).update(user.id, formData);
            // Refresh auth store to ensure local model is updated and onChange fires
            await pb.collection(collectionName).authRefresh();
        } catch (error) {
            console.error('Avatar update error details:', error);
            throw error;
        }
    };

    const updateStatus = async (status: User['status'], contextStatus?: string) => {
        // Se contextStatus for passado, usa ele. Caso contrário, limpa o status de contexto.
        const updateData: any = { status };
        if (contextStatus !== undefined) {
            updateData.context_status = contextStatus;
        } else {
            updateData.context_status = '';
        }
        await updateProfile(updateData);
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

    const requestPasswordReset = async (email: string) => {
        try {
            await pb.collection('agenda_cap53_usuarios').requestPasswordReset(email);
        } catch (error) {
            console.error('Request password reset error:', error);
            throw new Error(translateError(error));
        }
    };

    const confirmPasswordReset = async (token: string, password: string) => {
        try {
            await pb.collection('agenda_cap53_usuarios').confirmPasswordReset(
                token,
                password,
                password
            );
        } catch (error) {
            console.error('Confirm password reset error:', error);
            throw new Error(translateError(error));
        }
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            loading, 
            isSidebarOpen,
            setSidebarOpen,
            login, 
            register, 
            logout, 
            updateProfile, 
            updateAvatar,
            updateStatus, 
            setRole, 
            requestPasswordReset, 
            confirmPasswordReset 
        }}>
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
