
import { useState, useEffect, useMemo } from "react";
import { Student, Status } from "@/types";
import StudentCard from "./StudentCard";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { updateStudentStatus, saveAllStudents, deleteStudent, checkAndFixMigratedStudentFollowUps, updateStudent } from "@/services/supabaseService";
import { getPaymentsForMonth } from "@/services/paymentFilterService";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

interface KanbanBoardProps {
  students: Student[];
  onStudentUpdate: (updatedStudent: Student) => void;
  filteredStudents?: Student[];
  isFiltered: boolean;
  currentMonth?: string; // Para filtrar pagamentos por mês
}

const KanbanBoard = ({ students, onStudentUpdate, filteredStudents, isFiltered, currentMonth }: KanbanBoardProps) => {
  const { username } = useAuth();
  const [processingStudentId, setProcessingStudentId] = useState<string | null>(null);
  const [localStudents, setLocalStudents] = useState<Student[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [isDeletingStudent, setIsDeletingStudent] = useState<boolean>(false);
  const [filteredPayments, setFilteredPayments] = useState<Student[]>([]);
  
  // 🚀 OTIMIZAÇÃO: Calcular dias de atraso apenas quando necessário
  const calculateDaysLate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return (student: Student): number => {
      if (student.status === "pagamento-feito" || student.status === "rescisao-trancamento" || !student.dataVencimento) {
        return student.diasAtraso || 0;
      }
      
      try {
        const parts = student.dataVencimento.split('/');
        if (parts.length === 3) {
          const vencimentoDate = new Date(
            parseInt(parts[2]), 
            parseInt(parts[1]) - 1, 
            parseInt(parts[0])
          );
          
          const diffTime = today.getTime() - vencimentoDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          return diffDays > 0 ? diffDays : 0;
        }
      } catch (error) {
        console.error("Erro ao calcular dias em atraso:", error);
      }
      
      return student.diasAtraso || 0;
    };
  }, []); // Só recalcula uma vez por dia
  
  // Sincronizar o estado local com as props usando memoização
  const processedStudents = useMemo(() => {
    const studentsToShow = isFiltered && filteredStudents ? filteredStudents : students;
    
    console.log(`🚀 [Performance] Processando ${studentsToShow.length} estudantes`);
    
    return studentsToShow.map(student => ({
      ...student,
      diasAtraso: calculateDaysLate(student)
    }));
  }, [students, filteredStudents, isFiltered, calculateDaysLate]);
  
  // Sincronizar estado local apenas quando processedStudents mudar
  useEffect(() => {
    setLocalStudents(processedStudents);
    
    if (processedStudents.length > 0) {
      console.log(`✅ Estado sincronizado: ${processedStudents.length} estudantes`);
      setHasChanges(true);
    }
  }, [processedStudents]);

  // Filtrar pagamentos por mês quando o mês mudar
  useEffect(() => {
    if (!currentMonth) {
      setFilteredPayments([]); // Limpar filtro se não há mês selecionado
      return;
    }
    
    const filterPaymentsForMonth = async () => {
      try {
        console.log(`🔄 Filtrando pagamentos para o mês: ${currentMonth}`);
        const paymentsInMonth = await getPaymentsForMonth(localStudents, currentMonth);
        setFilteredPayments(paymentsInMonth);
        console.log(`✅ Pagamentos filtrados: ${paymentsInMonth.length} para ${currentMonth}`);
      } catch (error) {
        console.error("❌ Erro ao filtrar pagamentos:", error);
        setFilteredPayments([]);
      }
    };
    
    filterPaymentsForMonth();
  }, [localStudents, currentMonth]);
  
  // Usar os estudantes locais para exibição
  const studentsToShow = localStudents;
  
  // Definição das colunas do Kanban
  const columns: { id: Status; title: string; color: string }[] = [
    { id: "inadimplente", title: "Alunos Inadimplentes", color: "bg-kanban-overdue" },
    { id: "mensagem-enviada", title: "Mensagem Enviada", color: "bg-kanban-sent" },
    { id: "resposta-recebida", title: "Resposta Recebida", color: "bg-kanban-replied" },
    { id: "pagamento-feito", title: "Pagamento Realizado", color: "bg-kanban-paid" },
    { id: "rescisao-trancamento", title: "Rescisão/Trancamento", color: "bg-kanban-terminated" }
  ];

  // Mapeamento do status para o status anterior
  const previousStatusMap: Record<Status, Status> = {
    "inadimplente": "inadimplente", // Primeiro status, não tem anterior
    "mensagem-enviada": "inadimplente",
    "resposta-recebida": "mensagem-enviada",
    "pagamento-feito": "resposta-recebida",
    "rescisao-trancamento": "inadimplente"
  };

  // Agrupar estudantes por status
  const studentsByStatus: Record<Status, Student[]> = {
    "inadimplente": [],
    "mensagem-enviada": [],
    "resposta-recebida": [],
    "pagamento-feito": [],
    "rescisao-trancamento": []
  };

  studentsToShow.forEach(student => {
    // Para pagamentos, usar filtro apenas se currentMonth estiver definido
    if (student.status === "pagamento-feito") {
      if (currentMonth && filteredPayments.length > 0) {
        // Aplicar filtro de mês apenas se há pagamentos filtrados
        const isPaymentInCurrentMonth = filteredPayments.some(p => p.id === student.id);
        if (isPaymentInCurrentMonth) {
          studentsByStatus[student.status].push(student);
        }
      } else {
        // Se não há filtro ativo, mostrar todos os pagamentos
        studentsByStatus[student.status].push(student);
      }
    } else {
      // Para outros status, incluir normalmente
      studentsByStatus[student.status].push(student);
    }
  });

  // Função para atualizar o estado local
  const updateLocalStudent = (updatedStudent: Student) => {
    setLocalStudents(prev => 
      prev.map(student => 
        student.id === updatedStudent.id ? updatedStudent : student
      )
    );
    setHasChanges(true);
  };

  // Função para salvar todas as alterações no banco de dados
  const handleSaveChanges = async () => {
    console.log("handleSaveChanges called - hasChanges:", hasChanges, "students count:", localStudents.length);
    
    if (localStudents.length === 0) {
      toast.info("Não há dados para salvar");
      return;
    }

    try {
      setIsSaving(true);
      console.log("Salvando todas as alterações no banco de dados...", localStudents.length, "estudantes");
      
      // Forçar salvamento de todos os estudantes, independente de ter alterações
      await saveAllStudents(localStudents);
      
      toast.success("Dados salvos com sucesso no banco de dados", {
        description: `${localStudents.length} estudantes foram salvos.`
      });
      
      setHasChanges(false);
    } catch (error) {
      console.error("Erro ao salvar alterações:", error);
      toast.error("Erro ao salvar dados", {
        description: "Verifique sua conexão e tente novamente."
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Função para alterar o status de um aluno para o próximo
  const handleStatusChange = async (studentId: string, newStatus: Status) => {
    console.log(`handleStatusChange chamado para aluno ${studentId}, novo status: ${newStatus}`);
    
    // Evitar múltiplas chamadas simultâneas para o mesmo estudante
    if (processingStudentId === studentId) {
      console.log(`Aluno ${studentId} já está sendo processado, ignorando`);
      return;
    }
    
    setProcessingStudentId(studentId);
    
    const student = studentsToShow.find(s => s.id === studentId);
    
    if (!student) {
      console.log(`Aluno ${studentId} não encontrado`);
      setProcessingStudentId(null);
      toast.error("Aluno não encontrado", {
        description: "Não foi possível encontrar o aluno para atualizar o status."
      });
      return;
    }
    
    // 🔍 VALIDAÇÃO DE FOLLOW-UPS - Usando dados já carregados
    // 
    // Permite movimentação se:
    // - Existe pelo menos 1 follow-up nos dados carregados OU
    // - Campo antigo está preenchido (compatibilidade)
    if (student.status === "inadimplente" && newStatus !== "rescisao-trancamento") {
      const hasFollowUps = (student.followUps && student.followUps.length > 0) || student.followUp?.trim();
      
      if (!hasFollowUps) {
        console.log(`🔍 Aluno ${student.nome} não tem follow-ups. Tentando corrigir automaticamente...`);
        
        // Tentar corrigir automaticamente os follow-ups
        const fixed = await checkAndFixMigratedStudentFollowUps(student.id);
        
        if (fixed) {
          console.log(`✅ Follow-ups corrigidos automaticamente para ${student.nome}`);
          toast.success("Follow-ups corrigidos automaticamente", {
            description: "Tente mover o aluno novamente."
          });
          setProcessingStudentId(null);
          return;
        } else {
          toast.error("É necessário adicionar pelo menos um follow-up para mover o aluno", {
            description: "Abra os detalhes do aluno e adicione um follow-up antes de mover para a próxima etapa."
          });
          setProcessingStudentId(null);
          return;
        }
      }
      
      console.log(`✅ Aluno ${student.nome} tem ${student.followUps?.length || 0} follow-ups registrados. Pode mover.`);
    }
    
    // Verificar se o campo data de pagamento está preenchido quando movendo para "pagamento-feito"
    if (newStatus === "pagamento-feito" && (!student.dataPagamento || student.dataPagamento.trim() === "")) {
      toast.error("Data de pagamento é obrigatória", {
        description: "Preencha a data de pagamento no detalhe do aluno antes de mover para Pagamento Realizado."
      });
      setProcessingStudentId(null);
      return;
    }
    
    try {
      // Salvar o status antigo para o histórico
      const oldStatus = student.status;
      
      // Adicionar entrada ao histórico localmente primeiro
      const statusHistory = student.statusHistory || [];
      const historyEntry = {
        oldStatus: student.status,
        newStatus: newStatus,
        changedBy: username || 'Usuário não identificado',
        changedAt: new Date()
      };
      
      // Atualizar o status local imediatamente para feedback imediato ao usuário
      const updatedStudent = { 
        ...student, 
        status: newStatus,
        statusHistory: [...statusHistory, historyEntry]
      };
      
      // Atualizar estado local primeiro para feedback imediato
      updateLocalStudent(updatedStudent);
      
      // Atualizar a UI do componente pai
      onStudentUpdate(updatedStudent);
      
      console.log(`Atualizando status no banco de dados para aluno ${studentId}`);
      
      // Agora atualizar no banco de dados
      await updateStudentStatus(
        studentId, 
        oldStatus, 
        newStatus, 
        username || 'Usuário não identificado'
      );
      
      // Mensagem de confirmação
      toast.success(`Aluno movido com sucesso`, {
        description: `${student.nome} foi movido para ${columns.find(c => c.id === newStatus)?.title}`
      });
      
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      
      // Reverter para o status anterior no caso de erro
      const originalStudent = students.find(s => s.id === studentId);
      if (originalStudent) {
        updateLocalStudent({...originalStudent});
        onStudentUpdate({...originalStudent});
      }
      
      toast.error("Erro ao mover o aluno", {
        description: "Verifique sua conexão e tente novamente."
      });
    } finally {
      setProcessingStudentId(null);
    }
  };

  // Função para retornar o aluno para o status anterior
  const handleReturnToPreviousStatus = async (studentId: string) => {
    console.log(`handleReturnToPreviousStatus chamado para aluno ${studentId}`);
    
    // Evitar múltiplas chamadas simultâneas para o mesmo estudante
    if (processingStudentId === studentId) {
      console.log(`Aluno ${studentId} já está sendo processado, ignorando`);
      return;
    }
    
    setProcessingStudentId(studentId);
    
    const student = students.find(s => s.id === studentId);
    
    if (!student) {
      console.log(`Aluno ${studentId} não encontrado`);
      setProcessingStudentId(null);
      return;
    }
    
    // Se já está no primeiro status, não faz nada
    if (student.status === "inadimplente") {
      toast.info("Aluno já está no primeiro estágio", {
        description: "Não é possível retornar mais."
      });
      setProcessingStudentId(null);
      return;
    }
    
    try {
      // Obter o status anterior
      const previousStatus = previousStatusMap[student.status];
      
      // Adicionar entrada ao histórico localmente primeiro
      const statusHistory = student.statusHistory || [];
      const historyEntry = {
        oldStatus: student.status,
        newStatus: previousStatus,
        changedBy: username || 'Usuário não identificado',
        changedAt: new Date()
      };
      
      // Atualizar o status local imediatamente
      const updatedStudent = { 
        ...student, 
        status: previousStatus,
        statusHistory: [...statusHistory, historyEntry]
      };
      
      // Atualizar estado local primeiro para feedback imediato
      updateLocalStudent(updatedStudent);
      
      // Atualizar a UI do componente pai
      onStudentUpdate(updatedStudent);
      
      console.log(`Atualizando status no banco de dados para aluno ${studentId} (retorno)`);
      
      // Agora atualizar no banco de dados
      await updateStudentStatus(
        studentId, 
        student.status, 
        previousStatus, 
        username || 'Usuário não identificado'
      );
      
      // Mensagem de confirmação
      toast.success(`Aluno retornado com sucesso`, {
        description: `${student.nome} foi movido para ${columns.find(c => c.id === previousStatus)?.title}`
      });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      
      // Reverter para o status anterior no caso de erro
      const originalStudent = students.find(s => s.id === studentId);
      if (originalStudent) {
        updateLocalStudent({...originalStudent});
        onStudentUpdate({...originalStudent});
      }
      
      toast.error("Erro ao mover o aluno", {
        description: "Verifique sua conexão e tente novamente."
      });
    } finally {
      setProcessingStudentId(null);
    }
  };

  // Handler for student deletion
  const handleDeleteStudent = async (studentId: string) => {
    if (isDeletingStudent) {
      return;
    }
    
    try {
      setIsDeletingStudent(true);
      console.log(`Deleting student with ID: ${studentId}`);
      
      // Delete student from database
      await deleteStudent(studentId);
      
      // Update local state
      setLocalStudents(prev => prev.filter(student => student.id !== studentId));
      
      // Update parent component state
      // Index.tsx identifies a delete by an object containing only the id
      onStudentUpdate({ id: studentId } as Student);
      
      toast.success("Aluno excluído com sucesso", {
        description: "O aluno foi removido do sistema."
      });
    } catch (error) {
      console.error("Erro ao excluir aluno:", error);
      toast.error("Erro ao excluir aluno", {
        description: "Verifique sua conexão e tente novamente."
      });
    } finally {
      setIsDeletingStudent(false);
    }
  };

  // Função para atualizar dados completos do aluno
  const handleStudentDataUpdate = async (updatedStudent: Student) => {
    console.log(`handleStudentDataUpdate chamado para aluno ${updatedStudent.id}: ${updatedStudent.nome}`);
    
    try {
      // Atualizar estado local primeiro para feedback imediato
      updateLocalStudent(updatedStudent);
      
      // Atualizar a UI do componente pai
      onStudentUpdate(updatedStudent);
      
      // Atualizar no banco de dados
      await updateStudent(updatedStudent);
      
      console.log(`Dados do aluno ${updatedStudent.id} atualizados com sucesso`);
      
    } catch (error) {
      console.error("Erro ao atualizar dados do aluno:", error);
      
      // Reverter para os dados anteriores no caso de erro
      const originalStudent = students.find(s => s.id === updatedStudent.id);
      if (originalStudent) {
        updateLocalStudent({...originalStudent});
        onStudentUpdate({...originalStudent});
      }
    }
  };

  return (
    <div className="w-full overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Quadro de Cobrança</h2>
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleSaveChanges} 
            disabled={isSaving || localStudents.length === 0}
            className="flex items-center gap-2"
            variant={hasChanges ? "default" : "outline"}
          >
            <Save size={16} />
            {isSaving ? "Salvando..." : `Salvar no Banco (${localStudents.length})`}
          </Button>
          {isFiltered && (
            <div className="text-sm text-gray-500">
              Exibindo {studentsToShow.length} de {students.length} alunos
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(column => (
          <div 
            key={column.id}
            className="flex-1 min-w-[16rem] rounded-lg border shadow-sm"
          >
            {/* Cabeçalho da coluna */}
            <div className={`p-3 rounded-t-lg ${column.color} text-white font-medium flex justify-between items-center`}>
              <h3>{column.title}</h3>
              <span className="bg-white text-gray-800 text-xs px-2 py-1 rounded-full">
                {studentsByStatus[column.id].length}
              </span>
            </div>
            
            {/* Cartões dos alunos */}
            <div className="p-2 bg-gray-50 rounded-b-lg kanban-column">
              {studentsByStatus[column.id].length > 0 ? (
                studentsByStatus[column.id].map(student => (
                  <StudentCard 
                    key={student.id} 
                    student={student}
                    onStatusChange={handleStatusChange}
                    onReturnToPrevious={handleReturnToPreviousStatus}
                    onStudentUpdate={handleStudentDataUpdate}
                    onStudentDelete={handleDeleteStudent}
                  />
                ))
              ) : (
                <div className="p-4 text-center text-gray-500 italic text-sm">
                  Nenhum aluno nesta etapa
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KanbanBoard;
