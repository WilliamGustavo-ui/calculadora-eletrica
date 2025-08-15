// Importa a função para criar o cliente diretamente da biblioteca Supabase.
// Usar a URL do CDN com '/+esm' é a forma moderna de importar módulos.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://ahuvldyeownupkgjqusl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFodXZsZHllb3dudXBrZ2pxdXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyMDc3MDUsImV4cCI6MjA3MDc4MzcwNX0.pkDtP_ziDZzh2QNSN0FCDMA4PUbrgdvTPtP6-6O5W9k';

// Cria a instância do cliente Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);