'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, onAuthStateChanged } from 'firebase/auth'
import { auth, signOutUser } from '@/lib/firebase'
import { useRouter } from 'next/navigation'

interface AuthContextType {
    user: User | null
    loading: boolean
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

interface AuthProviderProps {
    children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUser(user)
                // Redirect if not on dashboard
                if (window.location.pathname === '/') {
                    router.push('/dashboard')
                }
            } else {
                setUser(null)
                // Redirect to login if not authenticated
                if (window.location.pathname !== '/') {
                    router.push('/')
                }
            }
            setLoading(false)
        })

        return () => unsubscribe()
    }, [router])

    const signOut = async () => {
        try {
            await signOutUser()
            router.push('/')
        } catch (error) {
            console.error('Error signing out:', error)
        }
    }

    const value = {
        user,
        loading,
        signOut
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

