
function Sys_Milliseconds() {
	if (!DATE.timeBase) {
		// javascript times are bigger, so start at zero
		//   pretend like we've been alive for at least a few seconds
		//   I actually had to do this because files it checking times and this caused a delay
		DATE.timeBase = Date.now() - 5000;
	}

	//if (window.performance.now) {
	//  return parseInt(window.performance.now(), 10);
	//} else if (window.performance.webkitNow) {
	//  return parseInt(window.performance.webkitNow(), 10);
	//} else {
	return Date.now() - DATE.timeBase;
	//}
}


let STD = {
  Sys_Milliseconds: Sys_Milliseconds,
  Printf: function () { debugger },
  Sys_Microseconds: function () { debugger },
  Hunk_Alloc: function () { debugger },
  Cmd_AddCommand: function () { debugger },
  Cmd_RemoveCommand: function () { debugger },
  Cmd_Argc: function () { debugger },
  Cmd_Argv: function () { debugger },
  Cbuf_ExecuteText: function () { debugger },
  CL_RefPrintf: function () { debugger },
  Com_Error: function () { debugger },
  CL_ScaledMilliseconds: function () { debugger },
  CL_RefMalloc: function () { debugger },
  CL_RefFreeAll: function () { debugger },
  Z_Free: function () { debugger },
  Hunk_AllocateTempMemory: function () { debugger },
  Hunk_FreeTempMemory: function () { debugger },

  CM_ClusterPVS: function () { debugger },
  CM_DrawDebugSurface: function () { debugger },

  FS_ReadFile: function () { debugger },
  FS_FreeFile: function () { debugger },
  FS_WriteFile: function () { debugger },
  FS_FreeFileList: function () { debugger },
  FS_ListFiles: function () { debugger },
  FS_FileIsInPAK: function () { debugger },
  FS_FileExists: function () { debugger },

  Cvar_Get: function () { debugger },
  Cvar_Set: function () { debugger },
  Cvar_SetValue: function () { debugger },
  Cvar_CheckRange: function () { debugger },
  Cvar_SetDescription: function () { debugger },
  Cvar_VariableStringBuffer: function () { debugger },
  Cvar_VariableString: function () { debugger },
  Cvar_VariableIntegerValue: function () { debugger },

  Cvar_SetGroup: function () { debugger },
  Cvar_CheckGroup: function () { debugger },
  Cvar_ResetGroup: function () { debugger },

  // cinematic stuff
  CIN_UploadCinematic: function () { debugger },
  CIN_PlayCinematic: function () { debugger },
  CIN_RunCinematic: function () { debugger },

  CL_WriteAVIVideoFrame: function () { debugger },

  CL_IsMininized: function () { debugger },
  CL_SetScaling: function () { debugger },

  Sys_SetClipboardBitmap: function () { debugger },
  Sys_LowPhysicalMemory: function () { debugger },
  Com_RealTime: function () { debugger },

  // OpenGL API
  GLimp_Init: function () { debugger },
  GLimp_Shutdown: function () { debugger },

  GLimp_EndFrame: function () { debugger },
  GLimp_InitGamma: function () { debugger },
  GLimp_SetGamma: function () { debugger },

  R_LoadPNG: function () { debugger },
  R_LoadJPG: function () { debugger },

  fd_close: function () { debugger },
	fd_seek: function () { debugger },
	fd_fdstat_get: function () { debugger },
	fd_write: function () { debugger },

}

if(typeof module != 'undefined') {
  module.exports = {
    STD: STD,
  }
}

