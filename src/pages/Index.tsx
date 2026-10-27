import { useState, useEffect, useCallback } from "react";
import { Student } from "@/types";
import Dashboard from "@/components/Dashboard";
import KanbanBoard from "@/components/KanbanBoard";
import { Button } from "@/components/ui/button";
import { Plus, Download, DollarSign, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DataLoader from "@/components/DataLoader";
import LoadingSkeletons from "@/components/LoadingSkeletons";
import PageHeader from "@/components/PageHeader";
import MonthSelectorWithCount from "@/components/MonthSelectorWithCount";
import { getSheetData, formatCurrency } from "@/lib/googleSheetsApi";
import { saveStudents, preserveExistingStatus } from "@/services/supabaseService";
import { toast } from "sonner";

// Mapeamento de meses para nomes de abas do Google Sheets
const monthSheetMap: Record<string, string> = {
  '05-2025': 'MAIO/25',
  'MAIO/25': 'MAIO/25',
  // Adicione outros mapeamentos conforme necessário
};

const Index = () => {
  // All state hooks at the top
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [loadingSource, setLoadingSource] = useState<"sheets" | "database" | "">("");
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const navigate = useNavigate();

  // Handle data loaded from DataLoader component
  const handleDataLoaded = useCallback((loadedStudents: Student[], source: "sheets" | "database" | "") => {
    console.log("Data loaded:", loadedStudents.length, "students from source:", source);
    setStudents(loadedStudents);
    setFilteredStudents([]);
    setActiveFilter(null);
    setLoadingSource(source);
  }, []);

  // Debug logging
  useEffect(() => {
    if (!loading && students.length > 0) {
      console.log("Current state - Total students:", students.length);
      console.log("Status distribution:", {
        inadimplente: students.filter(s => s.status === "inadimplente").length,
        mensagemEnviada: students.filter(s => s.status === "mensagem-enviada").length,
        respostaRecebida: students.filter(s => s.status === "resposta-recebida").length,
        pagamentoFeito: students.filter(s => s.status === "pagamento-feito").length
      });
    }
  }, [loading, students]);

  // Calculate total in default
  const totalEmInadimplencia = students
    .filter(s => s.status !== "pagamento-feito" && s.status !== "rescisao-trancamento")
    .reduce((total, student) => total + student.valor, 0);

  // Force import from sheet
  const handleForceImport = async () => {
    if (!selectedMonth) {
      toast.error("Select a month before importing data");
      return;
    }
    
    try {
      setIsImporting(true);
      toast.info(`Starting data import for month ${selectedMonth}...`);
      
      // Usar o nome correto da aba
      const sheetName = monthSheetMap[selectedMonth] || selectedMonth;
      
      // Get data directly from sheet
      const sheetsData = await getSheetData(sheetName);
      
      if (sheetsData.length === 0) {
        toast.error(`No students found in spreadsheet for month ${selectedMonth}`);
        setIsImporting(false);
        return;
      }
      
      console.log(`Importing ${sheetsData.length} students from spreadsheet for month ${selectedMonth}`);
      
      // Preservar status existente dos alunos
      const studentsWithPreservedStatus = await preserveExistingStatus(sheetsData, selectedMonth);
      
      // Save to database
      await saveStudents(studentsWithPreservedStatus, selectedMonth);
      
      // Update student list
      handleDataLoaded(studentsWithPreservedStatus, "sheets");
      
      toast.success(`Import completed successfully`, {
        description: `${sheetsData.length} students were imported to the database (status preserved)`
      });
    } catch (error) {
      console.error("Error importing data:", error);
      toast.error("Error importing data from spreadsheet", {
        description: "Check your connection and try again."
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Apply filters based on card selection
  const handleFilterChange = useCallback((filterId: string | null) => {
    if (!filterId) {
      setFilteredStudents([]);
      setActiveFilter(null);
      return;
    }
    
    let filtered: Student[] = [];
    
    switch(filterId) {
      case 'all':
        filtered = students.filter(student => 
          student.status === "inadimplente" || 
          student.status === "mensagem-enviada" || 
          student.status === "resposta-recebida"
        );
        break;
      case 'ate5dias':
        filtered = students.filter(student => student.diasAtraso <= 5);
        break;
      case 'ate10dias':
        filtered = students.filter(student => student.diasAtraso > 5 && student.diasAtraso <= 10);
        break;
      case 'mais10dias':
        filtered = students.filter(student => student.diasAtraso > 10);
        break;
      default:
        filtered = [];
    }
    
    setFilteredStudents(filtered);
    setActiveFilter(filterId);
  }, [students]);

  // Function to update a specific student
  const handleStudentUpdate = useCallback((updatedStudent: Student) => {
    console.log(`Updating student ${updatedStudent.id} with status ${updatedStudent.status}`);
    
    // Check if this is a delete operation (hack: we identify deletes by receiving a student object with just an id)
    const isDeleteOperation = Object.keys(updatedStudent).length === 1 && updatedStudent.id;
    
    if (isDeleteOperation) {
      console.log(`Deleting student ${updatedStudent.id} from local state`);
      // Remove the student from state
      setStudents(prevStudents => 
        prevStudents.filter(student => student.id !== updatedStudent.id)
      );
      
      // Also update filtered students if filter is active
      if (activeFilter) {
        setFilteredStudents(prevFiltered => 
          prevFiltered.filter(student => student.id !== updatedStudent.id)
        );
      }
      return;
    }
    
    // Otherwise, this is a regular update
    // Update local state first to reflect changes immediately
    setStudents(prevStudents => 
      prevStudents.map(student => 
        student.id === updatedStudent.id ? updatedStudent : student
      )
    );
    
    // Also update filtered students if filter is active
    if (activeFilter) {
      setFilteredStudents(prevFiltered => {
        const studentInFiltered = prevFiltered.some(s => s.id === updatedStudent.id);
        
        if (studentInFiltered) {
          return prevFiltered.map(student => 
            student.id === updatedStudent.id ? updatedStudent : student
          );
        }
        
        return prevFiltered;
      });
    }
  }, [activeFilter]);

  // Render content based on loading state and selected month
  const renderContent = () => {
    if (!selectedMonth) {
      return (
        <div className="mt-8 text-center text-gray-500">
          <p>Select a month to view data</p>
        </div>
      );
    }

    if (loading) {
      return <LoadingSkeletons />;
    }

    return (
      <>
        <Dashboard 
          students={students} 
          onFilterChange={handleFilterChange}
          activeFilter={activeFilter}
        />
        <KanbanBoard
          students={students}
          filteredStudents={filteredStudents}
          isFiltered={!!activeFilter}
          onStudentUpdate={handleStudentUpdate}
          currentMonth={selectedMonth}
        />
      </>
    );
  };

  // Handle refresh data
  const handleRefresh = useCallback(() => {
    if (!selectedMonth) {
      toast.error("Selecione um mês para atualizar os dados");
      return;
    }
    console.log("Refreshing data for month:", selectedMonth);
    setRefreshTrigger(prev => prev + 1);
    toast.info("Atualizando dados...");
  }, [selectedMonth]);

  // Handle loading state changes
  const handleLoadingChange = useCallback((isLoading: boolean) => {
    console.log(`Loading state changed to: ${isLoading}`);
    setLoading(isLoading);
  }, []);

  return (
    <div className="container mx-auto p-4">
      <PageHeader title="CRM de Cobrança - Rockfeller Navegantes" />
      
      <div className="flex justify-between items-center mb-8 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <MonthSelectorWithCount
            onMonthChange={(month) => {
              console.log(`Index: Month selected: ${month}`);
              setSelectedMonth(month);
            }}
            studentsCount={students.length}
            loadingSource={loadingSource}
            loading={loading}
            selectedMonth={selectedMonth}
          />
          <Button
            onClick={handleForceImport}
            disabled={isImporting || !selectedMonth}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {isImporting ? "Importing..." : "Import from Spreadsheet"}
          </Button>
          
          <Button
            onClick={handleRefresh}
            disabled={loading || !selectedMonth}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
          
          {!loading && students.length > 0 && (
            <div className="flex items-center px-4 py-2 bg-orange-100 border border-orange-200 rounded-md text-orange-800 font-medium">
              <DollarSign className="h-4 w-4 mr-1" />
              Total em inadimplência: {formatCurrency(totalEmInadimplencia)}
            </div>
          )}
        </div>
        <Button 
          onClick={() => navigate("/register-student")}
          className="flex items-center gap-2 bg-primary text-white"
        >
          <Plus className="h-4 w-4" />
          Novo Aluno
        </Button>
      </div>
      
      <DataLoader 
        selectedMonth={selectedMonth}
        onDataLoaded={handleDataLoaded}
        onLoadingChange={handleLoadingChange}
        refreshTrigger={refreshTrigger}
      />
      
      {renderContent()}
    </div>
  );
};

export default Index;
