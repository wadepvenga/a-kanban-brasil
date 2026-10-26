import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import AddNewMonthDialog from "./AddNewMonthDialog";
import { getAvailableMonthsFromDatabase, formatMonthDisplay, ensureMaioAvailable, getUniqueStudentMonths } from "@/services/monthsService";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface MonthSelectorProps {
  onMonthChange: (month: string) => void;
  value?: string; // Allow external control of selected month
}

const MonthSelector = ({ onMonthChange, value }: MonthSelectorProps) => {
  const [months, setMonths] = useState<{ month_value: string, display_name: string }[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [isAddMonthDialogOpen, setIsAddMonthDialogOpen] = useState<boolean>(false);
  const [monthToDelete, setMonthToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const fetchMonths = async () => {
      try {
        setLoading(true);
        // Buscar meses disponíveis do banco
        const availableMonths = await getAvailableMonthsFromDatabase();
        if (availableMonths.length > 0) {
          setMonths(availableMonths);
          
          // Only auto-select if no external value is provided and no month is currently selected
          if (!value && !selectedMonth) {
            // Prefer the current calendar month (MM-YYYY), falling back to the first available
            const now = new Date();
            const todayMonth = `${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
            const currentMonth = availableMonths.find(m => m.month_value === todayMonth)?.month_value
              ?? availableMonths[0].month_value;
            setSelectedMonth(currentMonth);
            onMonthChange(currentMonth);
          }
        }
      } catch (error) {
        console.error("Erro ao buscar meses:", error);
        toast.error("Não foi possível carregar os meses disponíveis");
      } finally {
        setLoading(false);
      }
    };
    fetchMonths();
  }, []); // Remove onMonthChange dependency to prevent infinite loops

  // Sync with external value prop
  useEffect(() => {
    if (value && value !== selectedMonth) {
      console.log(`MonthSelector: Syncing with external value: ${value}`);
      setSelectedMonth(value);
    }
  }, [value, selectedMonth]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const dropdown = document.getElementById('month-dropdown-list');
      if (dropdown && !dropdown.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const handleMonthChange = (newValue: string) => {
    console.log(`MonthSelector: Changing month from "${selectedMonth}" to "${newValue}"`);
    setSelectedMonth(newValue);
    onMonthChange(newValue);
  };

  const handleNewMonthAdded = (newMonth: string) => {
    // Adicionar o novo mês à lista e selecioná-lo
    setMonths(prev => [{ month_value: newMonth, display_name: formatMonthDisplay(newMonth) }, ...prev]);
    setSelectedMonth(newMonth);
    onMonthChange(newMonth);
    setIsAddMonthDialogOpen(false);
    toast.success(`Novo mês "${formatMonthDisplay(newMonth)}" criado com sucesso!`);
  };

  // Função para excluir mês e alunos
  const handleDeleteMonth = async () => {
    if (!monthToDelete) return;
    setDeleting(true);
    try {
      // Excluir alunos
      await supabase.from('students').delete().ilike('mes', monthToDelete);
      // Excluir mês
      await supabase.from('available_months').delete().ilike('display_name', monthToDelete);
      // Atualizar lista
      setMonths(prev => prev.filter(m => m.month_value !== monthToDelete));
      toast.success(`Mês ${monthToDelete} e alunos excluídos!`);
      // Se o mês excluído era o selecionado, selecionar o próximo disponível
      if (selectedMonth === monthToDelete) {
        const next = months.find(m => m.month_value !== monthToDelete)?.month_value || '';
        setSelectedMonth(next);
        onMonthChange(next);
      }
    } catch (error) {
      console.error('Erro ao excluir mês:', error);
      toast.error('Erro ao excluir mês');
    } finally {
      setDeleting(false);
      setMonthToDelete(null);
    }
  };

  return (
    <div className="flex items-center space-x-2 relative">
      <label className="text-sm font-medium">Selecione o mês:</label>
      <div className="relative">
        <button
          className="w-48 flex justify-between items-center border rounded px-3 py-2 bg-white shadow-sm"
          onClick={() => setDropdownOpen((open) => !open)}
          type="button"
        >
          <span>{selectedMonth ? formatMonthDisplay(selectedMonth) : "Selecionar mês"}</span>
          <ChevronDown className="w-4 h-4 ml-2" />
        </button>
        {dropdownOpen && (
          <div id="month-dropdown-list" className="absolute z-20 mt-1 w-48 bg-white border rounded shadow-lg max-h-72 overflow-y-auto">
            {months.map((month) => (
              <div
                key={month.month_value}
                className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-100 ${selectedMonth === month.month_value ? 'bg-gray-100 font-semibold' : ''}`}
                onClick={() => {
                  handleMonthChange(month.month_value);
                  setDropdownOpen(false);
                }}
              >
                <span>{month.display_name}</span>
                <button
                  type="button"
                  className="ml-2 text-red-500 hover:text-red-700 flex-shrink-0"
                  onClick={e => {
                    e.stopPropagation();
                    setMonthToDelete(month.month_value);
                  }}
                  title="Excluir mês"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <Button
        onClick={() => setIsAddMonthDialogOpen(true)}
        variant="outline"
        size="sm"
        className="flex items-center gap-1"
      >
        <Plus className="h-4 w-4" />
        Novo Mês
      </Button>
      <AddNewMonthDialog
        isOpen={isAddMonthDialogOpen}
        onClose={() => setIsAddMonthDialogOpen(false)}
        onMonthAdded={handleNewMonthAdded}
        existingMonths={months.map(m => m.month_value)}
      />
      {/* Modal de confirmação de exclusão */}
      <AlertDialog open={!!monthToDelete} onOpenChange={open => { if (!open) setMonthToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mês?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o mês <b>{monthToDelete && formatMonthDisplay(monthToDelete)}</b> e <b>todos os alunos desse mês</b>?<br />Essa ação não pode ser desfeita!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMonth} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MonthSelector;
