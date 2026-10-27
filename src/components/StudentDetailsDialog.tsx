
import { useState, useEffect } from "react";
import { Student } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { formatDateInput } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface StudentDetailsDialogProps {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedStudent: Student) => void;
}

const StudentDetailsDialog = ({ 
  student, 
  isOpen, 
  onClose, 
  onUpdate 
}: StudentDetailsDialogProps) => {
  const [followUp, setFollowUp] = useState(student.followUp || "");
  const [observacoes, setObservacoes] = useState(student.observacoes || "");
  const [dataPagamento, setDataPagamento] = useState(student.dataPagamento || "");
  const [isDateRequired, setIsDateRequired] = useState(false);

  // Reset form when student changes
  useEffect(() => {
    setFollowUp(student.followUp || "");
    setObservacoes(student.observacoes || "");
    setDataPagamento(student.dataPagamento || "");
    
    // Date is required when current status is "resposta-recebida" and we want to move to "pagamento-feito"
    setIsDateRequired(student.status === "resposta-recebida");
  }, [student]);

  const handleSave = () => {
    // Update the student object with the new values
    const updatedStudent = {
      ...student,
      followUp,
      observacoes,
      dataPagamento
    };
    
    onUpdate(updatedStudent);
    onClose();
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

  // Get status display name
  const getStatusDisplay = (status: string): string => {
    const statusDisplayMap: Record<string, string> = {
      "inadimplente": "Inadimplente",
      "mensagem-enviada": "Mensagem Enviada",
      "resposta-recebida": "Resposta Recebida",
      "pagamento-feito": "Pagamento Realizado",
      "rescisao-trancamento": "Rescisão/Trancamento"
    };
    
    return statusDisplayMap[status] || status;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalhes do Aluno</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg">{student.nome}</h3>
              <p className="text-sm text-gray-500">{formatCurrency(student.valor)}</p>
              <div className="flex gap-2 text-xs text-gray-400">
                <span>Vencimento: {student.dataVencimento}</span>
                <span>Mês: {student.mes}</span>
              </div>
              <div className="mt-1">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100">
                  {getStatusDisplay(student.status)}
                </span>
              </div>
              {student.diasAtraso > 0 && student.status !== "pagamento-feito" && (
                <p className="text-xs font-medium text-red-500 mt-1">
                  {student.diasAtraso} dias em atraso
                </p>
              )}
              {student.status === "pagamento-feito" && student.dataPagamento && (
                <p className="text-xs font-medium text-green-600 mt-1">
                  Pagamento realizado em: {formatDate(student.dataPagamento)}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="followUp">Follow Up</Label>
              <Textarea
                id="followUp"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                rows={3}
                placeholder="Adicione informações de acompanhamento aqui..."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                placeholder="Adicione observações aqui..."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dataPagamento">
                Data de Pagamento
                {isDateRequired && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Input
                id="dataPagamento"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(formatDateInput(e.target.value))}
                placeholder="DD/MM/YYYY"
                type="text"
                className={isDateRequired && !dataPagamento ? "border-red-500" : ""}
                maxLength={10}
              />
              {isDateRequired && (
                <p className="text-xs text-amber-600">
                  A data de pagamento é obrigatória para mover o aluno para "Pagamento Realizado"
                </p>
              )}
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
        </DialogContent>
    </Dialog>
  );
};

export default StudentDetailsDialog;
