import { Photo, Label } from '@/types/photo';

export const mockLabels: Label[] = [
  { id: '1', name: 'Paisagem', color: '#10B981' },
  { id: '2', name: 'Retrato', color: '#8B5CF6' },
  { id: '3', name: 'Família', color: '#F59E0B' },
  { id: '4', name: 'Viagem', color: '#EF4444' },
  { id: '5', name: 'Animais', color: '#06B6D4' },
  { id: '6', name: 'Comida', color: '#84CC16' },
  { id: '7', name: 'Trabalho', color: '#6B7280' },
  { id: '8', name: 'Eventos', color: '#EC4899' }
];

export const mockPhotos: Photo[] = [
  {
    id: '1',
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop',
    name: 'Montanhas ao Pôr do Sol',
    uploadDate: '2024-01-15',
    labels: ['1', '4'], // Paisagem, Viagem
    mediaType: 'photo'
  },
  {
    id: '2',
    url: 'https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?w=400&h=400&fit=crop',
    name: 'Café da Manhã',
    uploadDate: '2024-01-14',
    labels: ['6'], // Comida
    mediaType: 'photo'
  },
  {
    id: '3',
    url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=400&h=400&fit=crop',
    name: 'Cachorro no Parque',
    uploadDate: '2024-01-13',
    labels: ['5'], // Animais
    mediaType: 'photo'
  },
  {
    id: '4',
    url: 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=400&h=400&fit=crop',
    name: 'Reunião de Trabalho',
    uploadDate: '2024-01-12',
    labels: ['7'], // Trabalho
    mediaType: 'photo'
  },
  {
    id: '5',
    url: 'https://images.unsplash.com/photo-1549781379-2e4c0928b7d5?w=400&h=400&fit=crop',
    name: 'Família na Praia',
    uploadDate: '2024-01-11',
    labels: ['2', '3', '4'], // Retrato, Família, Viagem
    mediaType: 'photo'
  },
  {
    id: '6',
    url: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=400&fit=crop',
    name: 'Cidade à Noite',
    uploadDate: '2024-01-10',
    labels: ['1', '4'], // Paisagem, Viagem
    mediaType: 'photo'
  },
  {
    id: '7',
    url: 'https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?w=400&h=400&fit=crop',
    name: 'Aniversário',
    uploadDate: '2024-01-09',
    labels: ['8', '3'], // Eventos, Família
    mediaType: 'photo'
  },
  {
    id: '8',
    url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=400&fit=crop',
    name: 'Comida Italiana',
    uploadDate: '2024-01-08',
    labels: ['6'], // Comida
    mediaType: 'photo'
  }
];