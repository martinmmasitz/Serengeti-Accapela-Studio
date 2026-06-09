/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Project } from "./types";
import { DatabaseService } from "./services/db";
import AcapellaWorkstation from "./components/AcapellaWorkstation";
import { motion, AnimatePresence } from "motion/react";
import { 
  FolderPlus, 
  Trash2, 
  Music, 
  Search, 
  Calendar, 
  Layers, 
  ChevronRight, 
  Plus, 
  Sparkles,
  Volume2,
  Mic
} from "lucide-react";

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [loading, setLoading] = useState(true);

  // Load all projects from IndexedDB on components launch
  useEffect(() => {
    loadAllProjects();
  }, []);

  const loadAllProjects = async () => {
    try {
      setLoading(true);
      const loaded = await DatabaseService.getAllProjects();
      setProjects(loaded);
      
      // Auto-bootstrap a greeting project if IndexedDB is completely empty
      if (loaded.length === 0) {
        const bootstrapProject: Project = {
          id: "welcome-project",
          name: "Serengeti Vocal Solos Guide",
          description: "An initial workspace to test multi-track layering. Tap to open!",
          createdAt: new Date().toISOString(),
          tracks: [],
        };
        await DatabaseService.saveProject(bootstrapProject);
        setProjects([bootstrapProject]);
      }
    } catch (err) {
      console.error("Critical error reading local storage", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      const newProject: Project = {
        id: `project-${Date.now()}`,
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || "Multi-track layered vocal audio.",
        createdAt: new Date().toISOString(),
        tracks: [],
      };

      await DatabaseService.saveProject(newProject);
      setNewProjectName("");
      setNewProjectDesc("");
      setShowCreateModal(false);
      
      // Re-query database
      await loadAllProjects();
      
      // Instantly open the newly created studio space
      setSelectedProjectId(newProject.id);
    } catch (err) {
      console.error("Failed to write new project records to IndexedDB", err);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation(); // Avoid triggering open project selection click
    
    const confirmDelete = window.confirm("Are you sure you want to delete this acapella project?");
    if (!confirmDelete) return;

    try {
      await DatabaseService.deleteProject(projectId);
      await loadAllProjects();
      if (selectedProjectId === projectId) {
        setSelectedProjectId(null);
      }
    } catch (err) {
      console.error("Deletion failed", err);
    }
  };

  // Compute filtered project results from search inputs
  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="min-h-screen bg-[#0F1115] font-sans text-[#E0E0E0] flex flex-col justify-between selection:bg-red-500/30">
      
      {/* GLOWING AMBIENT SPACE ATMOSPHERE BACKGROUND */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-600/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[160px] pointer-events-none" />

      {/* DASHBOARD DRIVER CONTAINER */}
      <main className="flex-grow z-10 py-8 relative">
        <AnimatePresence mode="wait">
          {selectedProject ? (
            /* LAYER WORKSPACE WINDOWS */
            <motion.div
              key="workspace"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <AcapellaWorkstation
                project={selectedProject}
                onBack={() => {
                  setSelectedProjectId(null);
                  loadAllProjects(); // Refresh timeline meta counts
                }}
                onProjectUpdated={loadAllProjects}
              />
            </motion.div>
          ) : (
            /* LANDING PROJECT CATALOG */
            <motion.div
              key="catalog"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-4xl mx-auto px-4 space-y-8"
            >
              {/* BRAND GREETING HERO SECTION */}
              <div className="text-center space-y-3 pt-6">
                <div className="mx-auto w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/10">
                  <div className="w-4.5 h-4.5 bg-white rounded-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-red-600 rounded-full"></div>
                  </div>
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                  Serengeti Acapella Studio
                </h1>
                <p className="max-w-md mx-auto text-xs text-white/40 leading-relaxed font-sans uppercase tracking-widest font-semibold">
                  Professional Vocal Layering, Overdub Multi-Tracking & Latency Calibration
                </p>
              </div>

              {/* ACTION TOOLBARS */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-[#15171D] p-4 rounded-xl border border-white/10 backdrop-blur-md">
                
                {/* Search Bar query */}
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    placeholder="Search recording sessions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 hover:border-white/10 focus:border-red-500 pl-10 pr-4 py-2.5 text-xs rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-red-500/30 transition duration-150"
                  />
                </div>

                {/* Create Project Activator */}
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-600/5 shrink-0 cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>New Recording Studio</span>
                </button>
              </div>

              {/* CORE PROJECT LIST CARDS */}
              {loading ? (
                <div className="h-64 flex flex-col items-center justify-center space-y-2">
                  <div className="w-8 h-8 rounded-full border-2 border-red-600 border-t-transparent animate-spin" />
                  <span className="text-xs font-mono text-white/30">Retrieving vocal archives...</span>
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="h-64 border border-dashed border-white/5 bg-[#15171D]/40 rounded-xl flex flex-col items-center justify-center space-y-3 p-6 text-center">
                  <Music className="w-8 h-8 text-white/20" />
                  <div>
                    <h3 className="text-white/45 font-medium text-xs">No matching sessions</h3>
                    <p className="text-white/20 text-[11px] mt-0.5">Try searching with a different name or create a new multi-track workspace.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredProjects.map((project) => {
                    const totalLayers = project.tracks.length;
                    
                    return (
                      <div
                        key={project.id}
                        onClick={() => setSelectedProjectId(project.id)}
                        className="group bg-[#15171D] hover:bg-[#15171D]/90 border border-white/10 p-5 rounded-xl cursor-pointer transition-all duration-150 relative overflow-hidden flex flex-col justify-between h-48 hover:shadow-lg shadow-black/40"
                      >
                        {/* Animated overlay gradient glow on hover */}
                        <div className="absolute inset-0 bg-gradient-to-br from-red-600/0 via-transparent to-red-600/0 group-hover:from-red-600/[0.02] group-hover:to-red-600/[0.02] transition-all duration-300 pointer-events-none" />

                        {/* Top Metadata */}
                        <div>
                          <div className="flex justify-between items-start">
                            <span className="text-[9px] font-mono tracking-widest text-[#E0E0E0] uppercase bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                              Multitrack DAW
                            </span>
                            <button
                              onClick={(e) => handleDeleteProject(e, project.id)}
                              className="text-white/30 hover:text-red-500 p-1.5 hover:bg-white/5 rounded-lg transition duration-150"
                              title="Delete project"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <h3 className="text-base font-bold text-white group-hover:text-red-500 mt-3 tracking-tight transition duration-150 truncate">
                            {project.name}
                          </h3>
                          <p className="text-xs text-white/50 mt-1 line-clamp-2 leading-relaxed">
                            {project.description}
                          </p>
                        </div>

                        {/* Bottom Track count / date indicators */}
                        <div className="flex items-center justify-between border-t border-white/5 pt-3.5 mt-4">
                          <div className="flex items-center gap-3 text-[10px] text-white/40 font-mono">
                            <div className="flex items-center gap-1">
                              <Layers className="w-3.5 h-3.5 text-white/30" />
                              <span>{totalLayers} Layer{totalLayers !== 1 ? "s" : ""}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-white/30" />
                              <span>
                                {new Date(project.createdAt).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                          </div>

                          <span className="p-1 px-2.5 bg-white/5 group-hover:bg-red-600 group-hover:text-[#FFFFFF] border border-white/5 font-bold text-[10px] rounded-sm tracking-wider uppercase flex items-center gap-1 transition-all duration-150">
                            Launch <ChevronRight className="w-3 h-3 stroke-[2.5]" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FOOTER METADATA STATS */}
      <footer className="z-10 py-6 border-t border-white/10 bg-[#15171D]">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] font-mono text-white/40 font-semibold uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-red-500 animate-pulse" />
            <span>Serengeti Acapella Studio v1.2</span>
          </div>
          <div>
            <span>44.1kHz / 16-Bit Mono Audio Engine</span>
          </div>
          <div>
            <span>Powered by Client-Side Web Audio & IndexedDB</span>
          </div>
        </div>
      </footer>

      {/* NEW STUDIO CREATION OVERLAY SCREEN */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#15171D] border border-white/10 p-6 rounded-xl max-w-md w-full shadow-2xl space-y-4 text-left relative overflow-hidden"
            >
              {/* Decorative top strip */}
              <div className="absolute top-0 left-0 w-full h-[3px] bg-red-600" />

              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <FolderPlus className="text-red-500 w-5 h-5" /> Start Recording Studio
              </h2>

              <form onSubmit={handleCreateProject} className="space-y-4 font-sans text-xs">
                <div className="space-y-1.5">
                  <label className="text-white/60 text-xs font-semibold block uppercase tracking-wider">
                    Project Studio Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={40}
                    placeholder="e.g. Serengeti Sunset Harmony"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="w-full bg-black/45 border border-white/5 hover:border-white/10 focus:border-red-500 px-3.5 py-2.5 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-red-500/30 transition duration-150 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-white/60 text-xs font-semibold block uppercase tracking-wider">
                    Description (optional)
                  </label>
                  <textarea
                    placeholder="Describe your vocal themes, ranges, or overdub parts..."
                    maxLength={155}
                    rows={3}
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    className="w-full bg-black/45 border border-white/5 hover:border-white/10 focus:border-red-500 px-3.5 py-2.5 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-red-500/30 transition duration-150 resize-none text-xs leading-relaxed"
                  />
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setNewProjectName("");
                      setNewProjectDesc("");
                      setShowCreateModal(false);
                    }}
                    className="flex-1 py-3 px-4 bg-white/5 border border-white/5 hover:bg-white/10 font-bold rounded-lg text-[#E0E0E0] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition"
                  >
                    Launch Studio
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
