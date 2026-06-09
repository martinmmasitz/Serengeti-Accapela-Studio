/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Project, Track } from "../types";

const DB_NAME = "SerengetiAcapellaDB";
const STORE_NAME = "projects";
const DB_VERSION = 1;

/**
 * Open the IndexedDB database for Serengeti Acapella Studio.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error("Failed to open SerengetiAcapellaDB"));
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

/**
 * Converts dynamic track Blobs to data URLs/Blobs so they are ready for browser audio components.
 */
export function initializeTrackBlobUrls(tracks: Track[]): Track[] {
  return tracks.map((track) => {
    if (track.audioData && !track.blobUrl) {
      const blob = new Blob([track.audioData], { type: "audio/wav" });
      const blobUrl = URL.createObjectURL(blob);
      return { ...track, blobUrl };
    }
    return track;
  });
}

/**
 * Free resources in the browser memory from revoked audio object URLs.
 */
export function revokeTrackBlobUrls(tracks: Track[]): void {
  tracks.forEach((track) => {
    if (track.blobUrl && track.blobUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(track.blobUrl);
      } catch (err) {
        console.warn("Failed to revoke blob URL", err);
      }
    }
  });
}

export const DatabaseService = {
  /**
   * Fetch all projects from IndexedDB, assigning dynamic blobUrls.
   */
  async getAllProjects(): Promise<Project[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const rawProjects: Project[] = request.result || [];
        const initializedProjects = rawProjects.map((project) => ({
          ...project,
          tracks: initializeTrackBlobUrls(project.tracks),
        }));
        resolve(initializedProjects);
      };

      request.onerror = () => {
        reject(new Error("Failed to retrieve projects"));
      };
    });
  },

  /**
   * Get a single project by ID.
   */
  async getProject(id: string): Promise<Project | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const project: Project | null = request.result || null;
        if (project) {
          project.tracks = initializeTrackBlobUrls(project.tracks);
        }
        resolve(project);
      };

      request.onerror = () => {
        reject(new Error(`Failed to retrieve project with id: ${id}`));
      };
    });
  },

  /**
   * Save or update a project to IndexedDB.
   */
  async saveProject(project: Project): Promise<void> {
    const db = await openDB();
    // Prepare copy of project where we strip raw transient blobs out of track details
    // but keep audioData (ArrayBuffer) intact for saving.
    const projectToSave = {
      ...project,
      tracks: project.tracks.map((track) => {
        // Strip blobUrl when writing to DB to save space/cleanliness (will recreate on load),
        // but keep the key buffers.
        const { blobUrl, ...rest } = track;
        return {
          ...rest,
          // Explicitly keep audioData (which is indexable ArrayBuffer)
          audioData: track.audioData,
        };
      }),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(projectToSave);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error("Failed to save project"));
      };
    });
  },

  /**
   * Delete a project.
   */
  async deleteProject(id: string): Promise<void> {
    // Revoke any tracking blobs for this project prior to deletion
    const existing = await this.getProject(id);
    if (existing) {
      revokeTrackBlobUrls(existing.tracks);
    }

    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error("Failed to delete project"));
      };
    });
  },
};
