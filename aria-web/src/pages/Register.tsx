import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/UI/Button';
import { Card } from '@/components/UI/Card';
import { 
  Activity, 
  Mail, 
  Lock, 
  User, 
  Users, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  XCircle,
  ArrowRight,
  Shield,
  Heart,
  Award
} from 'lucide-react';

type RoleType = 'doctor' | 'radiologist' | 'nurse';

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  first_name: string;
  last_name: string;
  role: RoleType;
}

interface ValidationErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  first_name?: string;
  last_name?: string;
}

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading } = useAuth();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });
  
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    role: 'doctor',
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, message: '' });

  // Validation en temps réel
  useEffect(() => {
    const errors: ValidationErrors = {};
    
    // Validation email
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email invalide';
    }
    
    // Validation prénom
    if (formData.first_name && formData.first_name.length < 2) {
      errors.first_name = 'Le prénom doit contenir au moins 2 caractères';
    }
    
    // Validation nom
    if (formData.last_name && formData.last_name.length < 2) {
      errors.last_name = 'Le nom doit contenir au moins 2 caractères';
    }
    
    // Validation mot de passe
    if (formData.password) {
      let score = 0;
      if (formData.password.length >= 8) score++;
      if (formData.password.match(/[A-Z]/)) score++;
      if (formData.password.match(/[0-9]/)) score++;
      if (formData.password.match(/[^A-Za-z0-9]/)) score++;
      
      const messages = ['Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort'];
      setPasswordStrength({ score, message: messages[score] });
      
      if (formData.password.length < 8) {
        errors.password = '8 caractères minimum';
      }
    }
    
    // Validation confirmation
    if (formData.confirmPassword && formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }
    
    setValidationErrors(errors);
  }, [formData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setFocusedField(null);
  };

  const handleFocus = (field: string) => {
    setFocusedField(field);
  };

  const validateForm = (): boolean => {
    const allTouched: Record<string, boolean> = {};
    Object.keys(formData).forEach(key => {
      allTouched[key] = true;
    });
    setTouched(allTouched);
    
    return Object.keys(validationErrors).length === 0 && 
           formData.password === formData.confirmPassword &&
           formData.password.length >= 8;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const { confirmPassword, ...registerData } = formData;
    const success = await register(registerData);
    if (success) {
      navigate('/login');
    }
  };

  const roles = [
    { value: 'doctor', label: 'Médecin', icon: User, description: 'Prescriptions et analyses' },
    { value: 'radiologist', label: 'Radiologue', icon: Heart, description: 'Validation des résultats' },
    { value: 'nurse', label: 'Infirmier', icon: Shield, description: 'Gestion des patients' },
  ];

  const getPasswordStrengthColor = () => {
    const colors = ['#EF4444', '#F59E0B', '#F59E0B', '#10B981', '#10B981'];
    return colors[passwordStrength.score];
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4 } }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Arrière-plan animé */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-400 rounded-full opacity-20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-400 rounded-full opacity-20 blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-500 rounded-full opacity-10 blur-3xl" />
      </div>

      <div className="w-full max-w-5xl relative z-10" ref={ref}>
        <motion.div
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          variants={containerVariants}
          className="grid md:grid-cols-2 gap-8"
        >
          {/* Panneau gauche - Informations */}
          <motion.div variants={itemVariants} className="hidden md:flex flex-col justify-center text-white">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur rounded-2xl mb-6"
            >
              <Activity className="w-10 h-10 text-white" />
            </motion.div>
            
            <h1 className="text-4xl font-bold mb-4">ARIA</h1>
            <p className="text-xl text-white/80 mb-6">
              Automated Radiography<br />Intelligent Analysis
            </p>
            
            <div className="space-y-4 mt-8">
              {[
                { icon: Shield, text: 'Sécurité des données médicales' },
                { icon: Heart, text: 'Analyse IA de radiographies' },
                { icon: Award, text: 'Conformité RGPD' }
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <item.icon className="w-5 h-5 text-white/60" />
                  <span className="text-white/80">{item.text}</span>
                </motion.div>
              ))}
            </div>

            <div className="mt-12 pt-8 border-t border-white/10">
              <p className="text-white/60 text-sm">
                Déjà un compte ?{' '}
                <Link to="/login" className="text-white hover:underline font-medium">
                  Se connecter
                </Link>
              </p>
            </div>
          </motion.div>

          {/* Panneau droit - Formulaire */}
          <motion.div variants={itemVariants}>
            <Card className="bg-white/95 backdrop-blur-sm shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4">
                <h2 className="text-xl font-semibold text-white">Créer un compte</h2>
                <p className="text-primary-100 text-sm mt-1">Rejoignez la plateforme ARIA</p>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Nom et Prénom */}
                <div className="grid grid-cols-2 gap-4">
                  <motion.div variants={itemVariants}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prénom
                    </label>
                    <div className={`relative transition-all duration-200 ${focusedField === 'first_name' ? 'transform scale-[1.02]' : ''}`}>
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        name="first_name"
                        type="text"
                        value={formData.first_name}
                        onChange={handleChange}
                        onFocus={() => handleFocus('first_name')}
                        onBlur={() => handleBlur('first_name')}
                        className={`input pl-9 transition-all duration-200 ${
                          touched.first_name && validationErrors.first_name
                            ? 'border-red-500 focus:ring-red-500'
                            : touched.first_name && !validationErrors.first_name
                            ? 'border-green-500 focus:ring-green-500'
                            : ''
                        }`}
                        placeholder="Jean"
                      />
                      {touched.first_name && validationErrors.first_name && (
                        <XCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-red-500" />
                      )}
                      {touched.first_name && !validationErrors.first_name && formData.first_name && (
                        <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <AnimatePresence>
                      {touched.first_name && validationErrors.first_name && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="text-red-500 text-xs mt-1"
                        >
                          {validationErrors.first_name}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom
                    </label>
                    <div className={`relative transition-all duration-200 ${focusedField === 'last_name' ? 'transform scale-[1.02]' : ''}`}>
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        name="last_name"
                        type="text"
                        value={formData.last_name}
                        onChange={handleChange}
                        onFocus={() => handleFocus('last_name')}
                        onBlur={() => handleBlur('last_name')}
                        className={`input pl-9 transition-all duration-200 ${
                          touched.last_name && validationErrors.last_name
                            ? 'border-red-500 focus:ring-red-500'
                            : touched.last_name && !validationErrors.last_name
                            ? 'border-green-500 focus:ring-green-500'
                            : ''
                        }`}
                        placeholder="Dupont"
                      />
                      {touched.last_name && validationErrors.last_name && (
                        <XCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-red-500" />
                      )}
                      {touched.last_name && !validationErrors.last_name && formData.last_name && (
                        <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <AnimatePresence>
                      {touched.last_name && validationErrors.last_name && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="text-red-500 text-xs mt-1"
                        >
                          {validationErrors.last_name}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </div>

                {/* Email */}
                <motion.div variants={itemVariants}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email professionnel
                  </label>
                  <div className={`relative transition-all duration-200 ${focusedField === 'email' ? 'transform scale-[1.02]' : ''}`}>
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      onFocus={() => handleFocus('email')}
                      onBlur={() => handleBlur('email')}
                      className={`input pl-9 transition-all duration-200 ${
                        touched.email && validationErrors.email
                          ? 'border-red-500 focus:ring-red-500'
                          : touched.email && !validationErrors.email
                          ? 'border-green-500 focus:ring-green-500'
                          : ''
                      }`}
                      placeholder="medecin@hopital.fr"
                    />
                    {touched.email && validationErrors.email && (
                      <XCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-red-500" />
                    )}
                    {touched.email && !validationErrors.email && formData.email && (
                      <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-500" />
                    )}
                  </div>
                  <AnimatePresence>
                    {touched.email && validationErrors.email && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-red-500 text-xs mt-1"
                      >
                        {validationErrors.email}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Rôle */}
                <motion.div variants={itemVariants}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rôle
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      className="input pl-9 appearance-none cursor-pointer"
                    >
                      {roles.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label} - {role.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </motion.div>

                {/* Mot de passe */}
                <motion.div variants={itemVariants}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mot de passe
                  </label>
                  <div className={`relative transition-all duration-200 ${focusedField === 'password' ? 'transform scale-[1.02]' : ''}`}>
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleChange}
                      onFocus={() => handleFocus('password')}
                      onBlur={() => handleBlur('password')}
                      className={`input pl-9 pr-9 transition-all duration-200 ${
                        touched.password && validationErrors.password
                          ? 'border-red-500 focus:ring-red-500'
                          : touched.password && !validationErrors.password && formData.password
                          ? 'border-green-500 focus:ring-green-500'
                          : ''
                      }`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                  
                  {/* Indicateur de force du mot de passe */}
                  {formData.password && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                            className="h-full rounded-full transition-all duration-300"
                            style={{ backgroundColor: getPasswordStrengthColor() }}
                          />
                        </div>
                        <span className="text-xs" style={{ color: getPasswordStrengthColor() }}>
                          {passwordStrength.message}
                        </span>
                      </div>
                    </motion.div>
                  )}
                  
                  <AnimatePresence>
                    {touched.password && validationErrors.password && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-red-500 text-xs mt-1"
                      >
                        {validationErrors.password}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Confirmation mot de passe */}
                <motion.div variants={itemVariants}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirmer le mot de passe
                  </label>
                  <div className={`relative transition-all duration-200 ${focusedField === 'confirmPassword' ? 'transform scale-[1.02]' : ''}`}>
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      onFocus={() => handleFocus('confirmPassword')}
                      onBlur={() => handleBlur('confirmPassword')}
                      className={`input pl-9 pr-9 transition-all duration-200 ${
                        touched.confirmPassword && validationErrors.confirmPassword
                          ? 'border-red-500 focus:ring-red-500'
                          : touched.confirmPassword && !validationErrors.confirmPassword && formData.confirmPassword
                          ? 'border-green-500 focus:ring-green-500'
                          : ''
                      }`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                  <AnimatePresence>
                    {touched.confirmPassword && validationErrors.confirmPassword && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-red-500 text-xs mt-1"
                      >
                        {validationErrors.confirmPassword}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Bouton d'inscription */}
                <motion.div variants={itemVariants} className="pt-2">
                  <Button
                    type="submit"
                    isLoading={isLoading}
                    className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold py-3 rounded-xl transition-all duration-300 transform hover:scale-[1.02]"
                  >
                    {isLoading ? (
                      'Création du compte...'
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Créer mon compte
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </Button>
                </motion.div>

                {/* Lien mobile vers login */}
                <div className="md:hidden text-center pt-4">
                  <p className="text-sm text-gray-600">
                    Déjà un compte ?{' '}
                    <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                      Se connecter
                    </Link>
                  </p>
                </div>
              </form>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};