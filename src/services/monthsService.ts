import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getStudents, saveStudents } from "./supabaseService";
import { v4 as uuidv4 } from "uuid";

// Função para converter MM-YYYY para formato por extenso
export const formatMonthDisplay = (monthValue: string): string => {
  // Validar se o valor existe e está no formato correto
  if (!monthValue || typeof monthValue !== 'string') {
    console.warn('Invalid month value:', monthValue);
    return monthValue || '';
  }

  const parts = monthValue.split('-');
  if (parts.length !== 2) {
    console.warn('Month value not in MM-YYYY format:', monthValue);
    return monthValue;
  }

  const [month, year] = parts;
  
  // Validar se month e year existem
  if (!month || !year) {
    console.warn('Invalid month or year in:', monthValue);
    return monthValue;
  }

  const monthNames = [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
  ];
  
  const monthIndex = parseInt(month) - 1;
  
  // Validar se o índice do mês é válido
  if (monthIndex < 0 || monthIndex >= 12 || isNaN(monthIndex)) {
    console.warn('Invalid month index:', month, 'in value:', monthValue);
    return monthValue;
  }
  
  const shortYear = year.length >= 2 ? year.slice(-2) : year;
  
  return `${monthNames[monthIndex]}/${shortYear}`;
};

// Obter todos os meses disponíveis do banco de dados
export const getAvailableMonthsFromDatabase = async (): Promise<{ month_value: string, display_name: string }[]> => {
  try {
    console.log("Buscando meses disponíveis no banco de dados...");
    
    const { data, error } = await supabase
      .from('available_months')
      .select('month_value, display_name')
      .eq('is_active', true)
      .order('month_value', { ascending: false });
    
    if (error) {
      console.error("Erro ao buscar meses do banco:", error);
      return [];
    }
    
    if (!data || data.length === 0) {
      console.log("Nenhum mês encontrado no banco de dados");
      return [];
    }
    
    console.log(`Encontrados ${data.length} meses no banco:`, data);
    return data;
  } catch (error) {
    console.error("Erro ao obter meses do banco:", error);
    return [];
  }
};

// Criar um novo mês no banco de dados
export const createNewMonthInDatabase = async (monthValue: string): Promise<boolean> => {
  try {
    console.log(`Criando novo mês no banco: ${monthValue}`);
    
    const displayName = formatMonthDisplay(monthValue);
    
    const { error } = await supabase
      .from('available_months')
      .insert({
        month_value: monthValue,
        display_name: displayName,
        is_active: true
      });
    
    if (error) {
      if (error.code === "23505") { // Unique constraint violation
        console.warn("Mês já existe no banco:", monthValue);
        toast.error("Este mês já existe");
        return false;
      }
      console.error("Erro ao criar mês no banco:", error);
      toast.error("Erro ao criar novo mês no banco de dados");
      return false;
    }
    
    console.log(`Mês ${monthValue} criado com sucesso no banco`);
    return true;
  } catch (error) {
    console.error("Erro ao criar mês:", error);
    toast.error("Erro ao criar novo mês");
    return false;
  }
};

// Verificar se um mês existe no banco de dados
export const checkMonthExistsInDatabase = async (monthValue: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('available_months')
      .select('id')
      .eq('month_value', monthValue)
      .eq('is_active', true)
      .maybeSingle();
    
    if (error) {
      console.error("Erro ao verificar mês no banco:", error);
      return false;
    }
    
    return data !== null;
  } catch (error) {
    console.error("Erro ao verificar mês:", error);
    return false;
  }
};

// Verificar se existem dados de estudantes para um mês específico
export const checkStudentsForMonth = async (monthValue: string): Promise<number> => {
  try {
    console.log(`Verificando estudantes para o mês: ${monthValue}`);
    
    const { count, error } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('mes', monthValue);
    
    if (error) {
      console.error("Erro ao verificar estudantes do mês:", error);
      return 0;
    }
    
    const studentCount = count || 0;
    console.log(`Encontrados ${studentCount} estudantes para o mês ${monthValue}`);
    
    return studentCount;
  } catch (error) {
    console.error("Erro ao verificar estudantes:", error);
    return 0;
  }
};

// Garantir que maio/25 esteja disponível
export const ensureMaioAvailable = async (): Promise<void> => {
  try {
    console.log("Verificando se maio/25 está disponível...");
    
    const maioExists = await checkMonthExistsInDatabase('05-2025');
    
    if (!maioExists) {
      console.log("Maio/25 não encontrado, criando...");
      await createNewMonthInDatabase('05-2025');
    } else {
      console.log("Maio/25 já está disponível no banco");
    }
    
    // Verificar se há estudantes para maio
    const studentCount = await checkStudentsForMonth('05-2025');
    if (studentCount > 0) {
      console.log(`Maio/25 tem ${studentCount} estudantes cadastrados`);
    }
  } catch (error) {
    console.error("Erro ao garantir maio disponível:", error);
  }
};

// Importar alunos do mês anterior (exceto pagamento realizado) para o novo mês
export const importStudentsFromPreviousMonth = async (newMonth: string): Promise<void> => {
  try {
    // 1. Verificar se já existem alunos no novo mês para evitar duplicação total
    const existingStudentsInNewMonth = await getStudents(newMonth);
    const existingNames = new Set(existingStudentsInNewMonth.map(s => s.nome.toLowerCase().trim()));

    // Extrair mês e ano do novo mês
    const [newMonthNum, newYear] = newMonth.split("-");
    let prevMonthNum = parseInt(newMonthNum) - 1;
    let prevYear = parseInt(newYear);
    if (prevMonthNum === 0) {
      prevMonthNum = 12;
      prevYear -= 1;
    }
    const prevMonthMMYYYY = `${prevMonthNum.toString().padStart(2, "0")}-${prevYear}`;
    console.log(`Tentando importar alunos do mês anterior: ${prevMonthMMYYYY} para o novo mês: ${newMonth}`);

    // Buscar todos os valores únicos de mes existentes
    const uniqueMonths = await getUniqueStudentMonths();
    // Procurar o mês anterior real salvo no banco
    let prevMonthReal = uniqueMonths.find(m => m.includes("MAIO") || m === prevMonthMMYYYY) || prevMonthMMYYYY;
    console.log(`Mês anterior real encontrado para importação: ${prevMonthReal}`);

    // Buscar alunos do mês anterior real
    const prevStudents = await getStudents(prevMonthReal);
    if (!prevStudents || prevStudents.length === 0) {
      toast.info("Nenhum aluno encontrado no mês anterior para importar");
      return;
    }

    // Filtrar alunos que não estão em pagamento realizado E que ainda não existem no novo mês
    const studentsToImport = prevStudents.filter(s => {
      const isPaid = s.status === "pagamento-feito";
      const alreadyExists = existingNames.has(s.nome.toLowerCase().trim());
      
      if (alreadyExists) {
        console.log(`⏭️ Aluno ${s.nome} já existe no mês ${newMonth}, pulando...`);
      }
      
      return !isPaid && !alreadyExists;
    });

    if (studentsToImport.length === 0) {
      if (existingStudentsInNewMonth.length > 0) {
        toast.info("Todos os alunos elegíveis já foram importados para este mês.");
      } else {
        toast.info("Nenhum aluno para importar do mês anterior");
      }
      return;
    }

    // Duplicar alunos para o novo mês, mantendo status e dados, mas novo id
    const newStudents = studentsToImport.map(s => {
      const newId = uuidv4();
      console.log(`🔄 Migrando aluno ${s.nome} (ID: ${s.id} -> ${newId})`);
      console.log(`🔄 Status: ${s.status}, Follow-ups: ${s.followUps?.length || 0}`);
      
      return {
        ...s,
        id: newId,
        mes: newMonth,
        statusHistory: [], // Resetar histórico para o novo mês
        followUps: s.followUps || [] // Preservar follow-ups existentes
      };
    });

    // Salvar no banco
    await saveStudents(newStudents, newMonth);
    
    // Migrar follow-ups para os novos IDs
    await migrateFollowUpsToNewIds(studentsToImport, newStudents);
    
    toast.success(`${newStudents.length} alunos importados do mês anterior para o novo mês!`);
  } catch (error) {
    console.error("Erro ao importar alunos do mês anterior:", error);
    toast.error("Erro ao importar alunos do mês anterior");
  }
};

// Excluir um mês e seus alunos do banco de dados
export const deleteMonth = async (monthValue: string): Promise<boolean> => {
  try {
    console.log(`Excluindo mês ${monthValue} e seus alunos do banco de dados...`);
    
    // Primeiro, excluir todos os alunos do mês
    const { error: studentsError } = await supabase
      .from('students')
      .delete()
      .eq('mes', monthValue);
    
    if (studentsError) {
      console.error("Erro ao excluir alunos do mês:", studentsError);
      toast.error("Erro ao excluir alunos do mês");
      return false;
    }
    
    // Depois, excluir o mês da tabela de meses disponíveis
    const { error: monthError } = await supabase
      .from('available_months')
      .delete()
      .eq('month_value', monthValue);
    
    if (monthError) {
      console.error("Erro ao excluir mês:", monthError);
      toast.error("Erro ao excluir mês");
      return false;
    }
    
    console.log(`Mês ${monthValue} e seus alunos excluídos com sucesso`);
    toast.success(`Mês ${formatMonthDisplay(monthValue)} excluído com sucesso`);
    return true;
  } catch (error) {
    console.error("Erro ao excluir mês:", error);
    toast.error("Erro ao excluir mês");
    return false;
  }
};

// Buscar todos os valores únicos do campo 'mes' da tabela students
export const getUniqueStudentMonths = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('mes')
      .neq('mes', null);
    if (error) {
      console.error('Erro ao buscar meses únicos dos alunos:', error);
      return [];
    }
    const unique = [...new Set(data.map((d: any) => d.mes))];
    return unique;
  } catch (error) {
    console.error('Erro ao buscar meses únicos dos alunos:', error);
    return [];
  }
};

// Migrar follow-ups para novos IDs de alunos
const migrateFollowUpsToNewIds = async (oldStudents: Student[], newStudents: Student[]): Promise<void> => {
  try {
    console.log(`🔄 Migrando follow-ups para ${newStudents.length} alunos`);
    
    // Criar mapeamento de IDs antigos para novos
    const idMapping = new Map<string, string>();
    oldStudents.forEach((oldStudent, index) => {
      idMapping.set(oldStudent.id, newStudents[index].id);
    });
    
    let migratedCount = 0;
    
    for (const [oldId, newId] of idMapping) {
      try {
        // Buscar follow-ups do aluno antigo
        const { data: followUps, error } = await supabase
          .from('follow_ups')
          .select('*')
          .eq('student_id', oldId);
        
        if (error) {
          console.error(`❌ Erro ao buscar follow-ups para aluno ${oldId}:`, error);
          continue;
        }
        
        if (followUps && followUps.length > 0) {
          console.log(`🔄 Migrando ${followUps.length} follow-ups de ${oldId} para ${newId}`);
          
          // Criar novos follow-ups com o novo student_id
          const newFollowUps = followUps.map(fu => ({
            id: uuidv4(), // Novo ID para o follow-up
            student_id: newId, // Novo ID do aluno
            content: fu.content,
            created_by: fu.created_by,
            created_at: fu.created_at,
            updated_at: fu.updated_at
          }));
          
          // Inserir novos follow-ups
          const { error: insertError } = await supabase
            .from('follow_ups')
            .insert(newFollowUps);
          
          if (insertError) {
            console.error(`❌ Erro ao inserir follow-ups para aluno ${newId}:`, insertError);
          } else {
            console.log(`✅ ${newFollowUps.length} follow-ups migrados para aluno ${newId}`);
            migratedCount += newFollowUps.length;
          }
        }
      } catch (error) {
        console.error(`❌ Erro ao migrar follow-ups para aluno ${oldId}:`, error);
      }
    }
    
    console.log(`✅ Migração concluída: ${migratedCount} follow-ups migrados`);
    
  } catch (error) {
    console.error("❌ Erro geral na migração de follow-ups:", error);
  }
};
