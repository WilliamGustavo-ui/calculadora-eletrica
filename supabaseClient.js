// Importa a função para criar o cliente diretamente da biblioteca Supabase.
// Usar a URL do CDN com '/+esm' é a forma moderna de importar módulos.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://nlbkcnaocannelwdcqwa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sYmtjbmFvY2FubmVsd2RjcXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNTM4NTYsImV4cCI6MjA3MDgyOTg1Nn0.mLT8AWkqR0bzV_zRhr3d26ujJiv1vJFL03qiOFdHkRU';

// Cria a instância do cliente Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);