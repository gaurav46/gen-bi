import { ConnectionForm } from './ConnectionForm';
import { SchemaSelectionScreen } from './SchemaSelectionScreen';
import { EmbeddingProgressScreen } from './EmbeddingProgressScreen';
import { AnnotationScreen } from './AnnotationScreen';
import { useSchemaAnalysis } from './useSchemaAnalysis';

export function SettingsForm() {
  const {
    status,
    errorMessage,
    discoveredSchemas,
    selectedSchemas,
    analysisMessage,
    current,
    total,
    annotations,
    discoverSchemas,
    toggleSchema,
    analyze,
    saveAndEmbed,
    skipAnnotations,
    resetConnection,
  } = useSchemaAnalysis();

  const renderScreen = () => {
    switch (status) {
      case 'idle':
        return <ConnectionForm onConnected={discoverSchemas} />;
      case 'discovering':
        return <p className="text-sm">Discovering schemas...</p>;
      case 'ready':
        return (
          <SchemaSelectionScreen
            discoveredSchemas={discoveredSchemas}
            selectedSchemas={selectedSchemas}
            toggleSchema={toggleSchema}
            analyze={analyze}
            status={status}
            errorMessage={errorMessage}
            onChangeConnection={resetConnection}
          />
        );
      case 'introspected':
        if (annotations.length === 0) {
          return <p className="text-sm">Loading annotations...</p>;
        }
        return (
          <AnnotationScreen
            columns={annotations}
            onContinue={saveAndEmbed}
            onSkip={skipAnnotations}
          />
        );
      case 'embedding':
      case 'analyzing':
      case 'done':
        return (
          <EmbeddingProgressScreen
            status={status}
            analysisMessage={analysisMessage}
            current={current}
            total={total}
            errorMessage={errorMessage}
            analyze={analyze}
            onChangeConnection={resetConnection}
          />
        );
      case 'error':
        if (discoveredSchemas.length > 0) {
          return (
            <EmbeddingProgressScreen
              status={status}
              analysisMessage={analysisMessage}
              current={current}
              total={total}
              errorMessage={errorMessage}
              analyze={analyze}
              onChangeConnection={resetConnection}
            />
          );
        }
        return (
          <SchemaSelectionScreen
            discoveredSchemas={discoveredSchemas}
            selectedSchemas={selectedSchemas}
            toggleSchema={toggleSchema}
            analyze={analyze}
            status={status}
            errorMessage={errorMessage}
            onChangeConnection={resetConnection}
          />
        );
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold mb-4">Settings</h1>
      {renderScreen()}
    </div>
  );
}
