
import { useState } from "react";
import { Student, Status } from "@/types";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Trash2, UserX } from "lucide-react";
import StudentDetailsDialogV2 from "@/components/StudentDetailsDialogV2";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface StudentCardProps {
  student: Student;
  onStatusChange: (studentId: string, newStatus: Status) => void;
  onReturnToPrevious: (studentId: string) => void;
  onStudentUpdate: (updatedStudent: Student) => void;
  onStudentDelete?: (studentId: string) => void;
}

const StudentCard = ({ 
  student, 
  onStatusChange, 
  onReturnToPrevious, 
  onStudentUpdate,
  onStudentDelete
}: StudentCardProps) => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Next status mapping
  const nextStatusMap: Record<Status, Status> = {
    "inadimplente": "mensagem-enviada",
    "mensagem-enviada": "resposta-recebida",
    "resposta-recebida": "pagamento-feito",
    "pagamento-feito": "pagamento-feito", // Last stage has no next
    "rescisao-trancamento": "rescisao-trancamento" // Terminal stage, reached via the dedicated button
  };

  // Status display names
  const statusDisplayNames: Record<Status, string> = {
    "inadimplente": "Inadimplente",
    "mensagem-enviada": "Mensagem Enviada",
    "resposta-recebida": "Resposta Recebida",
    "pagamento-feito": "Pagamento Realizado",
    "rescisao-trancamento": "Rescisão/Trancamento"
  };

  // Get the next status
  const getNextStatus = (currentStatus: Status): Status | null => {
    return nextStatusMap[currentStatus];
  };

  // Format currency values
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Format date from YYYY-MM-DD to DD/MM/YYYY
  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    
    // If already in DD/MM/YYYY format, return as is
    if (dateString.includes('/')) return dateString;
    
    // Convert from YYYY-MM-DD to DD/MM/YYYY
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  // Handle status change
  const handleNextStatus = () => {
    const nextStatus = getNextStatus(student.status);
    if (nextStatus && nextStatus !== student.status) {
      onStatusChange(student.id, nextStatus);
    }
  };

  // Handle details dialog
  const handleOpenDetails = () => {
    setIsDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
  };

  // Handle delete student
  const handleDeleteStudent = () => {
    if (onStudentDelete) {
      onStudentDelete(student.id);
      setIsConfirmDeleteOpen(false);
    }
  };

  return (
    <Card className="mb-3 border-l-4 hover:shadow-md transition-shadow" 
      style={{ 
        borderLeftColor: 
          student.status === "inadimplente" ? "#ef4444" : 
          student.status === "mensagem-enviada" ? "#f59e0b" : 
          student.status === "resposta-recebida" ? "#3b82f6" : 
          student.status === "rescisao-trancamento" ? "#6b7280" : 
          "#10b981" 
      }}
    >
      <CardContent 
        className="p-3 cursor-pointer" 
        onClick={handleOpenDetails}
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold truncate mb-1" title={student.nome}>
              {student.nome}
            </h3>
            <p className="text-sm text-gray-500">
              {formatCurrency(student.valor)}
            </p>
            <p className="text-xs text-gray-400">
              Vencimento: {student.dataVencimento}
            </p>
            {student.diasAtraso > 0 && student.status !== "pagamento-feito" && student.status !== "rescisao-trancamento" && (
              <p className="text-xs font-medium text-red-500">
                {student.diasAtraso} dias em atraso
              </p>
            )}
            {student.status === "pagamento-feito" && student.dataPagamento && (
              <p className="text-xs font-medium text-green-600">
                Pago em: {formatDate(student.dataPagamento)}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {student.status !== "pagamento-feito" && student.status !== "rescisao-trancamento" && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-gray-500 hover:text-gray-800"
                title="Mover para Rescisão/Trancamento"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent opening the details dialog
                  onStatusChange(student.id, "rescisao-trancamento");
                }}
              >
                <UserX size={16} />
              </Button>
            )}
            <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 text-gray-500 hover:text-red-500"
                  title="Excluir aluno"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent opening the details dialog when clicking delete
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir o aluno "{student.nome}"? Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteStudent}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        
        {student.followUp && (
          <div className="mt-2">
            <p className="text-xs text-gray-600 line-clamp-2" title={student.followUp}>
              {student.followUp}
            </p>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="p-2 pt-0 flex justify-between">
        {student.status !== "inadimplente" && (
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs h-8 px-2"
            onClick={() => onReturnToPrevious(student.id)}
          >
            <ChevronLeft size={14} />
            Voltar
          </Button>
        )}
        {student.status === "inadimplente" && <div />}
        
        {student.status !== "pagamento-feito" && student.status !== "rescisao-trancamento" && (
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs h-8 px-2 ml-auto"
            onClick={handleNextStatus}
          >
            Avançar
            <ChevronRight size={14} />
          </Button>
        )}
      </CardFooter>
      
      {isDetailsOpen && (
        <StudentDetailsDialogV2 
          student={student}
          isOpen={isDetailsOpen}
          onClose={handleCloseDetails}
          onUpdate={onStudentUpdate}
        />
      )}
    </Card>
  );
};

export default StudentCard;
